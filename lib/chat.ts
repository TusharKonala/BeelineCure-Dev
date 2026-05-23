import { ChatSenderRole, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { inngest } from "@/inngest/client";
import {
  addConversationParticipant,
  chatLockAtFromCompletedAt,
  closeConversation,
  createAppointmentConversation,
  isChatLocked,
  sendConversationMessage,
  twilioUserIdentity,
} from "@/lib/twilio";

const CHAT_LOCK_MS = 48 * 60 * 60 * 1000;
const PUSH_DELAY_MS = 30 * 1000;

export function resolveAppOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "http://localhost:3000"
  );
}

export function chatThreadUrlForRole(
  role: UserRole,
  appointmentId: string,
): string {
  const base = resolveAppOrigin();
  if (role === UserRole.DOCTOR) {
    return `${base}/doctor/chat/${encodeURIComponent(appointmentId)}`;
  }
  return `${base}/patient/chat/${encodeURIComponent(appointmentId)}`;
}

async function scheduleChatLock(conversationId: string, lockAt: Date) {
  try {
    await inngest.send({
      name: "chat/lock.scheduled",
      data: { conversationId },
      ts: lockAt.getTime(),
    });
  } catch (err) {
    console.error("[chat] Failed to schedule lock:", err);
  }
}

async function provisionTwilioConversation(params: {
  conversationId: string;
  appointmentId: string;
  doctorUserId: string;
  patientUserId: string;
  friendlyName: string;
}) {
  const twilioSid = await createAppointmentConversation({
    appointmentId: params.appointmentId,
    doctorUserId: params.doctorUserId,
    patientUserId: params.patientUserId,
    friendlyName: params.friendlyName,
  });

  await addConversationParticipant({
    conversationSid: twilioSid,
    userId: params.doctorUserId,
  });
  await addConversationParticipant({
    conversationSid: twilioSid,
    userId: params.patientUserId,
  });

  await prisma.chatConversation.update({
    where: { id: params.conversationId },
    data: { twilioConversationSid: twilioSid },
  });

  return twilioSid;
}

export type EnsureChatResult =
  | { status: "created" | "exists" | "provisioned"; conversationId: string }
  | { status: "skipped_no_doctor_user" | "pending_patient_user"; conversationId?: string };

/**
 * Idempotently creates a chat conversation when an appointment is completed.
 */
export async function ensureChatConversationForAppointment(
  appointmentId: string,
): Promise<EnsureChatResult> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      patientName: true,
      email: true,
      status: true,
      doctor: {
        select: {
          name: true,
          userId: true,
        },
      },
    },
  });

  if (!appointment) {
    return { status: "skipped_no_doctor_user" };
  }

  const doctorUserId = appointment.doctor.userId;
  if (!doctorUserId) {
    console.warn(
      `[chat] Skipping conversation for appointment ${appointmentId}: doctor has no user account`,
    );
    return { status: "skipped_no_doctor_user" };
  }

  const patientUser = await prisma.user.findUnique({
    where: { email: appointment.email },
    select: { id: true },
  });

  const completedAt = new Date();
  const existing = await prisma.chatConversation.findUnique({
    where: { appointmentId },
  });

  if (existing) {
    if (
      patientUser &&
      !existing.patientUserId &&
      !existing.twilioConversationSid
    ) {
      await prisma.chatConversation.update({
        where: { id: existing.id },
        data: { patientUserId: patientUser.id },
      });
      await provisionTwilioConversation({
        conversationId: existing.id,
        appointmentId,
        doctorUserId,
        patientUserId: patientUser.id,
        friendlyName: `Chat: ${appointment.patientName} & ${appointment.doctor.name}`,
      });
      await scheduleChatLock(existing.id, chatLockAtFromCompletedAt(existing.completedAt));
      return { status: "provisioned", conversationId: existing.id };
    }

    if (
      patientUser &&
      existing.patientUserId &&
      !existing.twilioConversationSid
    ) {
      await provisionTwilioConversation({
        conversationId: existing.id,
        appointmentId,
        doctorUserId,
        patientUserId: patientUser.id,
        friendlyName: `Chat: ${appointment.patientName} & ${appointment.doctor.name}`,
      });
      return { status: "provisioned", conversationId: existing.id };
    }

    return { status: "exists", conversationId: existing.id };
  }

  if (!patientUser) {
    const row = await prisma.chatConversation.create({
      data: {
        appointmentId,
        doctorUserId,
        patientUserId: null,
        twilioConversationSid: null,
        completedAt,
      },
    });
    await scheduleChatLock(row.id, chatLockAtFromCompletedAt(completedAt));
    return { status: "pending_patient_user", conversationId: row.id };
  }

  const row = await prisma.chatConversation.create({
    data: {
      appointmentId,
      doctorUserId,
      patientUserId: patientUser.id,
      twilioConversationSid: null,
      completedAt,
    },
  });

  await provisionTwilioConversation({
    conversationId: row.id,
    appointmentId,
    doctorUserId,
    patientUserId: patientUser.id,
    friendlyName: `Chat: ${appointment.patientName} & ${appointment.doctor.name}`,
  });

  await scheduleChatLock(row.id, chatLockAtFromCompletedAt(completedAt));

  return { status: "created", conversationId: row.id };
}

type UnreadCountRow = { conversationId: string; count: bigint };

export async function getUnreadCountsForUser(userId: string) {
  const rows = await prisma.$queryRaw<UnreadCountRow[]>`
    SELECT m."conversationId", COUNT(*)::bigint AS count
    FROM "ChatMessage" m
    INNER JOIN "ChatConversation" c ON c.id = m."conversationId"
    LEFT JOIN "ChatReadState" rs
      ON rs."conversationId" = m."conversationId" AND rs."userId" = ${userId}
    WHERE (c."doctorUserId" = ${userId} OR c."patientUserId" = ${userId})
      AND m."senderUserId" != ${userId}
      AND m."createdAt" > COALESCE(rs."lastReadAt", TIMESTAMP '1970-01-01')
    GROUP BY m."conversationId"
  `;

  const byConversationId: Record<string, number> = {};
  for (const row of rows) {
    byConversationId[row.conversationId] = Number(row.count);
  }

  const total = Object.values(byConversationId).reduce((a, b) => a + b, 0);
  return { total, byConversationId };
}

/** Enqueue idempotent background provisioning for a completed appointment. */
export async function enqueueChatConversationEnsure(appointmentId: string) {
  await inngest.send({
    id: `chat-ensure-${appointmentId}`,
    name: "chat/conversation.ensure",
    data: { appointmentId },
  });
}

export async function markRead(conversationId: string, userId: string) {
  const now = new Date();
  await prisma.chatReadState.upsert({
    where: {
      conversationId_userId: { conversationId, userId },
    },
    create: { conversationId, userId, lastReadAt: now },
    update: { lastReadAt: now },
  });
}

export async function assertConversationAccess(
  conversationId: string,
  userId: string,
  role: UserRole,
) {
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: {
      appointment: {
        select: {
          id: true,
          email: true,
          patientName: true,
          doctor: { select: { name: true, userId: true } },
        },
      },
    },
  });

  if (!conversation) return null;

  if (role === UserRole.DOCTOR && conversation.doctorUserId === userId) {
    return conversation;
  }

  if (role === UserRole.PATIENT) {
    if (conversation.patientUserId === userId) {
      return conversation;
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (user?.email === conversation.appointment.email) {
      if (!conversation.patientUserId) {
        await prisma.chatConversation.update({
          where: { id: conversationId },
          data: { patientUserId: userId },
        });
      }
      return conversation;
    }
  }

  return null;
}

export async function lockConversation(conversationId: string) {
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    select: { twilioConversationSid: true, lockedAt: true },
  });
  if (!conversation || conversation.lockedAt) return;

  if (conversation.twilioConversationSid) {
    try {
      await closeConversation(conversation.twilioConversationSid);
    } catch (err) {
      console.error("[chat] Twilio close failed:", err);
    }
  }

  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: { lockedAt: new Date() },
  });
}

export async function sendChatMessage(params: {
  conversationId: string;
  senderUserId: string;
  senderRole: ChatSenderRole;
  body: string;
}) {
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: params.conversationId },
    select: {
      id: true,
      appointmentId: true,
      twilioConversationSid: true,
      completedAt: true,
      lockedAt: true,
      doctorUserId: true,
      patientUserId: true,
    },
  });

  if (!conversation?.twilioConversationSid) {
    throw new Error("Conversation not ready");
  }

  if (isChatLocked(conversation.completedAt, conversation.lockedAt)) {
    throw new Error("Conversation is read-only");
  }

  const twilioSid = await sendConversationMessage({
    conversationSid: conversation.twilioConversationSid,
    authorUserId: params.senderUserId,
    body: params.body,
  });

  const message = await prisma.chatMessage.create({
    data: {
      conversationId: params.conversationId,
      twilioMessageSid: twilioSid,
      senderUserId: params.senderUserId,
      senderRole: params.senderRole,
      body: params.body,
    },
    select: {
      id: true,
      twilioMessageSid: true,
      senderUserId: true,
      senderRole: true,
      body: true,
      createdAt: true,
    },
  });

  await markRead(params.conversationId, params.senderUserId);

  const recipientUserId =
    params.senderRole === ChatSenderRole.DOCTOR
      ? conversation.patientUserId
      : conversation.doctorUserId;

  if (recipientUserId) {
    try {
      await inngest.send({
        id: `push-${message.id}`,
        name: "chat/message.sent",
        data: { messageId: message.id },
        ts: Date.now() + PUSH_DELAY_MS,
      });
    } catch (err) {
      console.error("[chat] Failed to schedule push:", err);
    }
  }

  return message;
}

export { isChatLocked, chatLockAtFromCompletedAt, twilioUserIdentity, CHAT_LOCK_MS };
