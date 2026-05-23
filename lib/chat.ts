import { randomUUID } from "crypto";
import { ChatSenderRole, UserRole } from "@/generated/prisma/client";
import { notifyChatInboxAfterMessage } from "@/lib/chat-inbox-notify";
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
 * Idempotently creates or links a chat conversation row (no Twilio provisioning).
 */
export async function ensureChatConversationRecord(
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
    if (patientUser && !existing.patientUserId) {
      await prisma.chatConversation.update({
        where: { id: existing.id },
        data: { patientUserId: patientUser.id },
      });
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

  await scheduleChatLock(row.id, chatLockAtFromCompletedAt(completedAt));

  return { status: "created", conversationId: row.id };
}

/**
 * Idempotently creates a chat conversation when an appointment is completed,
 * including Twilio provisioning when applicable.
 */
export async function ensureChatConversationForAppointment(
  appointmentId: string,
): Promise<EnsureChatResult> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      patientName: true,
      email: true,
      doctor: { select: { name: true, userId: true } },
    },
  });

  if (!appointment?.doctor.userId) {
    return ensureChatConversationRecord(appointmentId);
  }

  const recordResult = await ensureChatConversationRecord(appointmentId);
  if (
    recordResult.status === "skipped_no_doctor_user" ||
    recordResult.status === "pending_patient_user" ||
    !recordResult.conversationId
  ) {
    return recordResult;
  }

  const conversationId = recordResult.conversationId;
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      appointmentId: true,
      doctorUserId: true,
      patientUserId: true,
      twilioConversationSid: true,
      completedAt: true,
    },
  });

  if (!conversation?.patientUserId || conversation.twilioConversationSid) {
    return recordResult;
  }

  await provisionTwilioConversation({
    conversationId: conversation.id,
    appointmentId,
    doctorUserId: conversation.doctorUserId,
    patientUserId: conversation.patientUserId,
    friendlyName: `Chat: ${appointment.patientName} & ${appointment.doctor.name}`,
  });

  if (recordResult.status === "created") {
    return { status: "created", conversationId };
  }
  return { status: "provisioned", conversationId };
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

const conversationForMessageSelect = {
  id: true,
  appointmentId: true,
  twilioConversationSid: true,
  completedAt: true,
  lockedAt: true,
  doctorUserId: true,
  patientUserId: true,
} as const;

export type PersistedChatMessage = {
  id: string;
  twilioMessageSid: string;
  senderUserId: string;
  senderRole: ChatSenderRole;
  body: string;
  createdAt: Date;
};

export type ConversationForDelivery = {
  id: string;
  appointmentId: string;
  twilioConversationSid: string;
  doctorUserId: string;
  patientUserId: string | null;
};

/** Saves message to DB and marks read for sender (fast path). */
export async function persistChatMessage(params: {
  conversationId: string;
  senderUserId: string;
  senderRole: ChatSenderRole;
  body: string;
}): Promise<{
  message: PersistedChatMessage;
  conversation: ConversationForDelivery;
}> {
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: params.conversationId },
    select: conversationForMessageSelect,
  });

  if (!conversation?.twilioConversationSid) {
    throw new Error("Conversation not ready");
  }

  if (isChatLocked(conversation.completedAt, conversation.lockedAt)) {
    throw new Error("Conversation is read-only");
  }

  const pendingSid = `pending-${randomUUID()}`;
  const message = await prisma.chatMessage.create({
    data: {
      conversationId: params.conversationId,
      twilioMessageSid: pendingSid,
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

  return {
    message,
    conversation: {
      id: conversation.id,
      appointmentId: conversation.appointmentId,
      twilioConversationSid: conversation.twilioConversationSid,
      doctorUserId: conversation.doctorUserId,
      patientUserId: conversation.patientUserId,
    },
  };
}

/** Twilio sync, inbox notify, and push scheduling (background). */
export async function deliverChatMessage(params: {
  message: PersistedChatMessage;
  conversation: ConversationForDelivery;
  senderUserId: string;
  senderRole: ChatSenderRole;
}) {
  const { message, conversation, senderUserId, senderRole } = params;

  try {
    const twilioSid = await sendConversationMessage({
      conversationSid: conversation.twilioConversationSid,
      authorUserId: senderUserId,
      body: message.body,
    });
    await prisma.chatMessage.update({
      where: { id: message.id },
      data: { twilioMessageSid: twilioSid },
    });
  } catch (err) {
    console.error("[chat] Twilio message sync failed:", err);
  }

  try {
    await notifyChatInboxAfterMessage({
      conversationId: conversation.id,
      appointmentId: conversation.appointmentId,
      senderUserId,
      senderRole,
      messageBody: message.body,
      messageCreatedAt: message.createdAt,
    });
  } catch (err) {
    console.error("[chat] Inbox notify failed:", err);
  }

  const recipientUserId =
    senderRole === ChatSenderRole.DOCTOR
      ? conversation.patientUserId
      : conversation.doctorUserId;

  if (recipientUserId) {
    try {
      const slot = Math.floor(Date.now() / 30_000);
      await inngest.send({
        id: `push-${conversation.id}-${slot}`,
        name: "chat/message.sent",
        data: { conversationId: conversation.id, messageId: message.id },
        ts: Date.now() + PUSH_DELAY_MS,
      });
    } catch (err) {
      console.error("[chat] Failed to schedule push:", err);
    }
  }
}

export { isChatLocked, chatLockAtFromCompletedAt, twilioUserIdentity, CHAT_LOCK_MS };
