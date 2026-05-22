import type { ChatInboxUpdatePayload } from "@/lib/chat-realtime-types";

type InboxListener = (payload: ChatInboxUpdatePayload) => void;

const listeners = new Set<InboxListener>();

export function subscribeChatInbox(listener: InboxListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitChatInbox(payload: ChatInboxUpdatePayload) {
  for (const listener of listeners) {
    listener(payload);
  }
}
