import type { ChatSenderRole } from "@/generated/prisma/client";

export type ChatMessagePushPayload = {
  id: string;
  body: string;
  senderUserId: string;
  senderRole: ChatSenderRole;
  createdAt: string;
  messageType?: string;
};

export type ChatMessageDeletedPayload = {
  id: string;
  isDeletedForEveryone: boolean;
};

export type ChatInboxUpdatePayload = {
  type: "message" | "thread";
  conversationId: string;
  appointmentId: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  senderUserId: string;
  peerName: string;
  peerSubtitle: string | null;
  peerPhotoUrl: string | null;
  isReadOnly: boolean;
  isReady: boolean;
};
