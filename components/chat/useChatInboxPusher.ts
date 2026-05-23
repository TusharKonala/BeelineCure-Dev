"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import Pusher from "pusher-js";
import type { ChatInboxUpdatePayload } from "@/lib/chat-realtime-types";
import { emitChatInbox } from "@/components/chat/chat-inbox-bus";
import { CHAT_UNREAD_COUNT_EVENT } from "@/lib/chat-events";

let activeConnections = 0;
let sharedPusher: Pusher | null = null;
let sharedChannel: ReturnType<Pusher["subscribe"]> | null = null;
let sharedUserId: string | null = null;

export function syncGlobalUnreadBadge(total: number) {
  window.dispatchEvent(
    new CustomEvent<number>(CHAT_UNREAD_COUNT_EVENT, {
      detail: Math.max(0, Math.floor(total)),
    }),
  );
}

export async function refreshUnreadFromServer(): Promise<{
  total: number;
  byConversationId: Record<string, number>;
} | null> {
  try {
    const res = await fetch("/api/chat/unread-counts", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      total?: unknown;
      byConversationId?: Record<string, number>;
    };
    const total =
      typeof data.total === "number" && Number.isFinite(data.total)
        ? Math.max(0, Math.floor(data.total))
        : 0;
    const byConversationId = data.byConversationId ?? {};
    syncGlobalUnreadBadge(total);
    return { total, byConversationId };
  } catch {
    return null;
  }
}

function disconnectShared() {
  if (sharedChannel && sharedUserId) {
    sharedChannel.unbind("inbox-update");
    sharedPusher?.unsubscribe(`private-user-${sharedUserId}`);
  }
  sharedPusher?.disconnect();
  sharedPusher = null;
  sharedChannel = null;
  sharedUserId = null;
}

function ensureSharedConnection(userId: string) {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) return;

  if (sharedPusher && sharedUserId === userId) return;

  disconnectShared();

  sharedPusher = new Pusher(key, {
    cluster,
    authEndpoint: "/api/pusher/auth",
  });
  sharedUserId = userId;
  sharedChannel = sharedPusher.subscribe(`private-user-${userId}`);
  sharedChannel.bind("inbox-update", (payload: ChatInboxUpdatePayload) => {
    void refreshUnreadFromServer();
    emitChatInbox(payload);
  });
}

/** Mount once per authenticated shell (patient layout / doctor shell). */
export function useChatInboxPusher() {
  const { data: session, status } = useSession();

  useEffect(() => {
    const userId = session?.user?.id;
    if (status !== "authenticated" || !userId) return;

    activeConnections += 1;
    ensureSharedConnection(userId);

    return () => {
      activeConnections -= 1;
      if (activeConnections <= 0) {
        activeConnections = 0;
        disconnectShared();
      }
    };
  }, [status, session?.user?.id]);
}
