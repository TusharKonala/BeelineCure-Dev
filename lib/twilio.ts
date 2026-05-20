import Twilio from "twilio";

const CHAT_LOCK_MS = 48 * 60 * 60 * 1000;

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!accountSid || !authToken) {
    throw new Error("[twilio] TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required");
  }
  return Twilio(accountSid, authToken);
}

function getConversationServiceSid() {
  const sid = process.env.TWILIO_CONVERSATION_SERVICE_SID?.trim();
  if (!sid) {
    throw new Error("[twilio] TWILIO_CONVERSATION_SERVICE_SID is required");
  }
  return sid;
}

export function twilioUserIdentity(userId: string): string {
  return `user:${userId}`;
}

export function chatLockAtFromCompletedAt(completedAt: Date): Date {
  return new Date(completedAt.getTime() + CHAT_LOCK_MS);
}

export function isChatLocked(completedAt: Date, lockedAt: Date | null): boolean {
  if (lockedAt) return true;
  return Date.now() >= chatLockAtFromCompletedAt(completedAt).getTime();
}

export async function createAppointmentConversation(params: {
  appointmentId: string;
  doctorUserId: string;
  patientUserId: string | null;
  friendlyName: string;
}) {
  const client = getTwilioClient();
  const serviceSid = getConversationServiceSid();

  const conversation = await client.conversations.v1
    .services(serviceSid)
    .conversations.create({
      friendlyName: params.friendlyName,
      attributes: JSON.stringify({
        appointmentId: params.appointmentId,
        doctorUserId: params.doctorUserId,
        patientUserId: params.patientUserId,
      }),
    });

  return conversation.sid;
}

export async function addConversationParticipant(params: {
  conversationSid: string;
  userId: string;
}) {
  const client = getTwilioClient();
  const serviceSid = getConversationServiceSid();
  const identity = twilioUserIdentity(params.userId);

  try {
    await client.conversations.v1
      .services(serviceSid)
      .conversations(params.conversationSid)
      .participants.create({ identity });
  } catch (err: unknown) {
    const code =
      err && typeof err === "object" && "code" in err
        ? Number((err as { code?: number }).code)
        : null;
    // Participant already in conversation (idempotent re-provision).
    if (code === 50433 || code === 50416) return;
    throw err;
  }
}

export async function sendConversationMessage(params: {
  conversationSid: string;
  authorUserId: string;
  body: string;
}) {
  const client = getTwilioClient();
  const serviceSid = getConversationServiceSid();

  const message = await client.conversations.v1
    .services(serviceSid)
    .conversations(params.conversationSid)
    .messages.create({
      author: twilioUserIdentity(params.authorUserId),
      body: params.body,
    });

  return message.sid;
}

export type TwilioConversationMessage = {
  sid: string;
  author: string | null;
  body: string | null;
  dateCreated: Date | null;
};

export async function listConversationMessages(params: {
  conversationSid: string;
  pageSize?: number;
}): Promise<TwilioConversationMessage[]> {
  const client = getTwilioClient();
  const serviceSid = getConversationServiceSid();

  const messages = await client.conversations.v1
    .services(serviceSid)
    .conversations(params.conversationSid)
    .messages.list({ limit: params.pageSize ?? 50 });

  return messages.map((m) => ({
    sid: m.sid,
    author: m.author ?? null,
    body: m.body ?? null,
    dateCreated: m.dateCreated ?? null,
  }));
}

export async function closeConversation(conversationSid: string) {
  const client = getTwilioClient();
  const serviceSid = getConversationServiceSid();

  await client.conversations.v1
    .services(serviceSid)
    .conversations(conversationSid)
    .update({ state: "closed" });
}
