import Pusher from "pusher";
import type { ChatSenderRole } from "@/generated/prisma/client";

let pusherServer: Pusher | null = null;

function getPusherServer() {
  if (pusherServer) return pusherServer;

  const appId = process.env.PUSHER_APP_ID?.trim();
  const key = process.env.PUSHER_KEY?.trim();
  const secret = process.env.PUSHER_SECRET?.trim();
  const cluster = process.env.PUSHER_CLUSTER?.trim();

  if (!appId || !key || !secret || !cluster) {
    throw new Error(
      "[pusher] PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, and PUSHER_CLUSTER are required",
    );
  }

  pusherServer = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

  return pusherServer;
}

export type ChatMessagePushPayload = {
  id: string;
  body: string;
  senderUserId: string;
  senderRole: ChatSenderRole;
  createdAt: string;
};

export async function triggerNewChatMessage(
  conversationId: string,
  message: ChatMessagePushPayload,
) {
  const pusher = getPusherServer();
  await pusher.trigger(`conversation-${conversationId}`, "new-message", message);
}
