import {
  AppointmentStatus,
  ChatSenderRole,
  UserRole,
} from "@/generated/prisma/client";
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

/**
 * Ensures conversations exist for all completed appointments for a patient user.
 */
export async function lazyEnsureForPatient(userId: string, email: string) {
  const completedAppointments = await prisma.appointment.findMany({
    where: {
      email,
      status: AppointmentStatus.COMPLETED,
      chatConversation: null,
    },
    select: { id: true },
  });

  for (const apt of completedAppointments) {
    try {
      await ensureChatConversationForAppointment(apt.id);
    } catch (err) {
      console.error(`[chat] lazyEnsure failed for ${apt.id}:`, err);
    }
  }

  const pendingRows = await prisma.chatConversation.findMany({
    where: {
      patientUserId: null,
      appointment: { email },
    },
    select: { appointmentId: true },
  });

  for (const row of pendingRows) {
    try {
      await ensureChatConversationForAppointment(row.appointmentId);
    } catch (err) {
      console.error(`[chat] lazyEnsure pending failed:`, err);
    }
  }

  await prisma.chatConversation.updateMany({
    where: {
      patientUserId: null,
      appointment: { email },
    },
    data: { patientUserId: userId },
  });
}

export async function getUnreadCountsForUser(userId: string) {
  const readStates = await prisma.chatReadState.findMany({
    where: { userId },
    select: { conversationId: true, lastReadAt: true },
  });
  const readMap = new Map(
    readStates.map((r) => [r.conversationId, r.lastReadAt]),
  );

  const conversations = await prisma.chatConversation.findMany({
    where: {
      OR: [{ doctorUserId: userId }, { patientUserId: userId }],
    },
    select: { id: true },
  });

  const conversationIds = conversations.map((c) => c.id);
  if (conversationIds.length === 0) {
    return { total: 0, byConversationId: {} as Record<string, number> };
  }

  const messages = await prisma.chatMessage.findMany({
    where: {
      conversationId: { in: conversationIds },
      senderUserId: { not: userId },
    },
    select: { conversationId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const byConversationId: Record<string, number> = {};
  for (const msg of messages) {
    const lastRead = readMap.get(msg.conversationId) ?? new Date(0);
    if (msg.createdAt > lastRead) {
      byConversationId[msg.conversationId] =
        (byConversationId[msg.conversationId] ?? 0) + 1;
    }
  }

  const total = Object.values(byConversationId).reduce((a, b) => a + b, 0);
  return { total, byConversationId };
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
        name: "chat/message.sent",
        data: { messageId: message.id },
        ts: Date.now() + 2 * 60 * 1000,
      });
    } catch (err) {
      console.error("[chat] Failed to schedule push:", err);
    }
  }

  return message;
}

export { isChatLocked, chatLockAtFromCompletedAt, twilioUserIdentity, CHAT_LOCK_MS };
