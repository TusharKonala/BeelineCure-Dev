"use client";

import { useChatInboxPusher } from "@/components/chat/useChatInboxPusher";

/** Subscribes to private inbox Pusher channel for navbar badges and list sync. */
export function ChatInboxRealtime() {
  useChatInboxPusher();
  return null;
}
