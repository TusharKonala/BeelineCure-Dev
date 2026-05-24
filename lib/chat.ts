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

export async function getUnreadCountsForUser(
  userId: string,
  userEmail?: string | null,
) {
  const email = userEmail?.trim().toLowerCase() ?? "";
  const rows = await prisma.$queryRaw<UnreadCountRow[]>`
    SELECT m."conversationId", COUNT(*)::bigint AS count
    FROM "ChatMessage" m
    INNER JOIN "ChatConversation" c ON c.id = m."conversationId"
    INNER JOIN "Appointment" a ON a.id = c."appointmentId"
    LEFT JOIN "ChatReadState" rs
      ON rs."conversationId" = m."conversationId" AND rs."userId" = ${userId}
    WHERE (
      c."doctorUserId" = ${userId}
      OR c."patientUserId" = ${userId}
      OR (${email} <> '' AND LOWER(a.email) = ${email})
    )
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

function normalizeChatEmail(email: string): string {
  return email.trim().toLowerCase();
}

type ConversationAccessFields = {
  doctorUserId: string;
  patientUserId: string | null;
  appointmentEmail: string;
};

type ConversationAccessResult =
  | { allowed: true; linkPatientUserId: boolean }
  | { allowed: false };

/** Pure access check shared by assertConversationAccess and sendChatMessage. */
export function resolveConversationAccess(
  conversation: ConversationAccessFields,
  params: { userId: string; role: UserRole; userEmail?: string | null },
): ConversationAccessResult {
  const { userId, role, userEmail } = params;

  if (role === UserRole.DOCTOR) {
    if (conversation.doctorUserId === userId) {
      return { allowed: true, linkPatientUserId: false };
    }
    return { allowed: false };
  }

  if (role === UserRole.PATIENT) {
    if (conversation.patientUserId === userId) {
      return { allowed: true, linkPatientUserId: false };
    }
    const email = userEmail?.trim();
    if (
      email &&
      normalizeChatEmail(email) ===
        normalizeChatEmail(conversation.appointmentEmail)
    ) {
      return {
        allowed: true,
        linkPatientUserId: conversation.patientUserId === null,
      };
    }
    return { allowed: false };
  }

  return { allowed: false };
}

export async function linkPatientUserOnConversation(
  conversationId: string,
  userId: string,
) {
  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: { patientUserId: userId },
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

  let userEmail: string | null | undefined;
  if (
    role === UserRole.PATIENT &&
    conversation.patientUserId !== userId
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    userEmail = user?.email ?? null;
  }

  const access = resolveConversationAccess(
    {
      doctorUserId: conversation.doctorUserId,
      patientUserId: conversation.patientUserId,
      appointmentEmail: conversation.appointment.email,
    },
    { userId, role, userEmail },
  );

  if (!access.allowed) return null;

  if (access.linkPatientUserId) {
    await linkPatientUserOnConversation(conversationId, userId);
  }

  return conversation;
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

export type ChatMessageForClient = {
  id: string;
  body: string;
  senderUserId: string;
  senderRole: ChatSenderRole;
  isOwn: boolean;
  createdAt: string;
};

export type ChatMessagesPage = {
  messages: ChatMessageForClient[];
  hasMore: boolean;
};

export const CHAT_MESSAGE_PAGE_SIZE = 50;

const messageListSelect = {
  id: true,
  senderUserId: true,
  senderRole: true,
  body: true,
  createdAt: true,
} as const;

function mapDbMessagesToClient(
  dbMessages: {
    id: string;
    senderUserId: string;
    senderRole: ChatSenderRole;
    body: string;
    createdAt: Date;
  }[],
  userId: string,
): ChatMessageForClient[] {
  return [...dbMessages].reverse().map((m) => ({
    id: m.id,
    body: m.body,
    senderUserId: m.senderUserId,
    senderRole: m.senderRole,
    isOwn: m.senderUserId === userId,
    createdAt: m.createdAt.toISOString(),
  }));
}

/** Latest N messages (desc from DB), returned oldest → newest for the UI. */
export async function fetchRecentMessagesForConversation(
  conversationId: string,
  userId: string,
  limit = CHAT_MESSAGE_PAGE_SIZE,
): Promise<ChatMessagesPage> {
  const dbMessages = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: messageListSelect,
  });

  const hasMore = dbMessages.length > limit;
  const page = hasMore ? dbMessages.slice(0, limit) : dbMessages;

  return {
    messages: mapDbMessagesToClient(page, userId),
    hasMore,
  };
}

/** Messages older than `before`, returned oldest → newest for prepending in the UI. */
export async function fetchOlderMessagesForConversation(
  conversationId: string,
  userId: string,
  before: Date,
  limit = CHAT_MESSAGE_PAGE_SIZE,
): Promise<ChatMessagesPage> {
  const dbMessages = await prisma.chatMessage.findMany({
    where: { conversationId, createdAt: { lt: before } },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: messageListSelect,
  });

  const hasMore = dbMessages.length > limit;
  const page = hasMore ? dbMessages.slice(0, limit) : dbMessages;

  return {
    messages: mapDbMessagesToClient(page, userId),
    hasMore,
  };
}

/**
 * POST fast path: one conversation read + one message create before response.
 * Caller should run markRead (and optional patient link) in after().
 */
export async function sendChatMessage(params: {
  conversationId: string;
  userId: string;
  role: UserRole;
  userEmail?: string | null;
  senderRole: ChatSenderRole;
  body: string;
}): Promise<{
  message: PersistedChatMessage;
  conversation: ConversationForDelivery;
  linkPatientUserId: boolean;
}> {
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: params.conversationId },
    select: {
      ...conversationForMessageSelect,
      appointment: { select: { email: true } },
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const access = resolveConversationAccess(
    {
      doctorUserId: conversation.doctorUserId,
      patientUserId: conversation.patientUserId,
      appointmentEmail: conversation.appointment.email,
    },
    {
      userId: params.userId,
      role: params.role,
      userEmail: params.userEmail,
    },
  );

  if (!access.allowed) {
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
      senderUserId: params.userId,
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

  return {
    message,
    conversation: {
      id: conversation.id,
      appointmentId: conversation.appointmentId,
      doctorUserId: conversation.doctorUserId,
      patientUserId: conversation.patientUserId,
    },
    linkPatientUserId: access.linkPatientUserId,
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
