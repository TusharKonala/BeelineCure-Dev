import { randomUUID } from "crypto";
import { ChatSenderRole, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { inngest } from "@/inngest/client";

const CHAT_LOCK_MS = 48 * 60 * 60 * 1000;
const PUSH_DELAY_MS = 30 * 1000;

export function chatLockAtFromCompletedAt(completedAt: Date): Date {
  return new Date(completedAt.getTime() + CHAT_LOCK_MS);
}

export function isChatLocked(completedAt: Date, lockedAt: Date | null): boolean {
  if (lockedAt) return true;
  return Date.now() >= chatLockAtFromCompletedAt(completedAt).getTime();
}

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

export type EnsureChatResult =
  | { status: "created" | "exists"; conversationId: string }
  | { status: "skipped_no_doctor_user" | "pending_patient_user"; conversationId?: string };

/**
 * Idempotently creates or links a chat conversation row.
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

/** Idempotently creates a chat conversation when an appointment is completed. */
export async function ensureChatConversationForAppointment(
  appointmentId: string,
): Promise<EnsureChatResult> {
  return ensureChatConversationRecord(appointmentId);
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

/** Enqueue idempotent background record creation for a completed appointment. */
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
    select: { lockedAt: true },
  });
  if (!conversation || conversation.lockedAt) return;

  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: { lockedAt: new Date() },
  });
}

const conversationForMessageSelect = {
  id: true,
  appointmentId: true,
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

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (isChatLocked(conversation.completedAt, conversation.lockedAt)) {
    throw new Error("Conversation is read-only");
  }

  const localSid = `local-${randomUUID()}`;
  const message = await prisma.chatMessage.create({
    data: {
      conversationId: params.conversationId,
      twilioMessageSid: localSid,
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
      doctorUserId: conversation.doctorUserId,
      patientUserId: conversation.patientUserId,
    },
  };
}

/** Schedules delayed push notification for the recipient. */
export async function scheduleChatMessagePush(params: {
  message: PersistedChatMessage;
  conversation: ConversationForDelivery;
  senderRole: ChatSenderRole;
}) {
  const { message, conversation, senderRole } = params;

  const recipientUserId =
    senderRole === ChatSenderRole.DOCTOR
      ? conversation.patientUserId
      : conversation.doctorUserId;

  if (!recipientUserId) return;

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

export { CHAT_LOCK_MS };
