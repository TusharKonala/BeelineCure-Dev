"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import useInfiniteScroll from "react-infinite-scroll-hook";
import { Loader2, MessageCircle } from "lucide-react";
import type { ChatInboxUpdatePayload } from "@/lib/chat-realtime-types";
import { formatListMessageTime } from "@/components/chat/format-chat-time";
import { subscribeChatInbox } from "@/components/chat/chat-inbox-bus";
import { refreshUnreadFromServer } from "@/components/chat/useChatInboxPusher";

type ChatThread = {
  id: string;
  appointmentId: string;
  peerName: string;
  peerSubtitle: string | null;
  peerPhotoUrl: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  isReadOnly: boolean;
  isReady: boolean;
};

type ChatListClientProps = {
  basePath: "/patient/chat" | "/doctor/chat";
};

const PAGE_SIZE = 5;

function sortThreadsByActivity(list: ChatThread[]): ChatThread[] {
  return [...list].sort((a, b) => {
    const at = a.lastMessageAt
      ? new Date(a.lastMessageAt).getTime()
      : 0;
    const bt = b.lastMessageAt
      ? new Date(b.lastMessageAt).getTime()
      : 0;
    return bt - at;
  });
}

function threadFromInboxPayload(
  payload: ChatInboxUpdatePayload,
  existing?: ChatThread,
): ChatThread {
  return {
    id: payload.conversationId,
    appointmentId: payload.appointmentId,
    peerName: payload.peerName,
    peerSubtitle: payload.peerSubtitle,
    peerPhotoUrl: payload.peerPhotoUrl,
    lastMessagePreview: payload.lastMessagePreview,
    lastMessageAt: payload.lastMessageAt,
    unreadCount: existing?.unreadCount ?? 0,
    isReadOnly: payload.isReadOnly,
    isReady: payload.isReady,
  };
}

function applyUnreadCounts(
  list: ChatThread[],
  byConversationId: Record<string, number>,
): ChatThread[] {
  return list.map((t) => ({
    ...t,
    unreadCount: t.id.startsWith("pending-")
      ? 0
      : (byConversationId[t.id] ?? 0),
  }));
}

export function ChatListClient({ basePath }: ChatListClientProps) {
  const { status } = useSession();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const handleInboxUpdate = useCallback((payload: ChatInboxUpdatePayload) => {
    setThreads((prev) => {
      const idx = prev.findIndex(
        (t) => t.appointmentId === payload.appointmentId,
      );
      let next: ChatThread[];
      if (idx >= 0) {
        const existing = prev[idx]!;
        const incoming = threadFromInboxPayload(payload, existing);
        next = [...prev];
        next[idx] = {
          ...existing,
          ...incoming,
          id: existing.id.startsWith("pending-") ? incoming.id : existing.id,
        };
      } else {
        next = [threadFromInboxPayload(payload), ...prev];
      }
      return sortThreadsByActivity(next);
    });

    void refreshUnreadFromServer().then((counts) => {
      if (!counts) return;
      setThreads((prev) => applyUnreadCounts(prev, counts.byConversationId));
    });
  }, []);

  useEffect(() => {
    return subscribeChatInbox(handleInboxUpdate);
  }, [handleInboxUpdate]);

  const fetchGlobalUnread = useCallback(async () => {
    const counts = await refreshUnreadFromServer();
    if (!counts) return;
    setThreads((prev) => applyUnreadCounts(prev, counts.byConversationId));
  }, []);

  const fetchThreads = useCallback(
    async (cursor: string | null, append: boolean) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(`/api/chat/threads?${params}`, { cache: "no-store" });
      if (!res.ok) return null;

      const data = (await res.json()) as {
        threads?: ChatThread[];
        nextCursor?: string | null;
      };
      const list = Array.isArray(data.threads) ? data.threads : [];
      const next = data.nextCursor ?? null;

      if (append) {
        setThreads((prev) => {
          const seen = new Set(prev.map((t) => t.appointmentId));
          const merged = sortThreadsByActivity([
            ...prev,
            ...list.filter((t) => !seen.has(t.appointmentId)),
          ]);
          return merged;
        });
      } else {
        setThreads(sortThreadsByActivity(list));
      }

      setNextCursor(next);
      setHasMore(Boolean(next));
      void fetchGlobalUnread();
      return list;
    },
    [fetchGlobalUnread],
  );

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    async function init() {
      setLoading(true);
      try {
        await fetchThreads(null, false);
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [status, fetchThreads]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchThreads(nextCursor, true);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, nextCursor, loadingMore, fetchThreads]);

  const [infiniteRef] = useInfiniteScroll({
    loading: loadingMore,
    hasNextPage: hasMore,
    onLoadMore: loadMore,
    disabled: loading || !hasMore,
  });

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[#2555F3]" />
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e5e5e5] bg-white px-6 py-12 text-center">
        <MessageCircle className="mx-auto size-10 text-[#9A9A9A]" strokeWidth={1.5} />
        <p className="mt-3 font-montserrat text-sm font-medium text-[#333333]">
          No chats yet
        </p>
        <p className="mt-1 font-montserrat text-sm text-[#5E5E5E]">
          {basePath === "/patient/chat"
            ? "Chats open after you complete an appointment with a doctor."
            : "Patients who message you will appear here."}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {threads.map((thread) => {
        const timeLabel = formatListMessageTime(thread.lastMessageAt);
        return (
          <li key={thread.appointmentId}>
            <Link
              href={`${basePath}/${encodeURIComponent(thread.appointmentId)}`}
              className="flex items-center gap-3 rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 transition-colors hover:bg-[#fafcff]"
            >
              {thread.peerPhotoUrl ? (
                <Image
                  src={thread.peerPhotoUrl}
                  alt=""
                  width={44}
                  height={44}
                  className="size-11 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#f5f8ff] font-montserrat text-sm font-semibold text-[#2555F3]">
                  {thread.peerName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-montserrat text-sm font-semibold text-[#333333]">
                    {thread.peerName}
                  </p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {timeLabel && (
                      <span className="font-montserrat text-[10px] text-[#9A9A9A]">
                        {timeLabel}
                      </span>
                    )}
                    {thread.unreadCount > 0 && (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#2555F3] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                        {thread.unreadCount > 99 ? "99+" : thread.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
                {thread.peerSubtitle && (
                  <p className="truncate font-montserrat text-xs text-[#9A9A9A]">
                    {thread.peerSubtitle}
                  </p>
                )}
                {thread.lastMessagePreview ? (
                  <p className="mt-0.5 truncate font-montserrat text-xs text-[#5E5E5E]">
                    {thread.lastMessagePreview}
                  </p>
                ) : (
                  <p className="mt-0.5 font-montserrat text-xs text-[#9A9A9A]">
                    {thread.isReady ? "Start a conversation" : "Setting up chat…"}
                  </p>
                )}
                {thread.isReadOnly && (
                  <p className="mt-0.5 font-montserrat text-[10px] text-[#9A9A9A]">
                    Read-only
                  </p>
                )}
              </div>
            </Link>
          </li>
        );
      })}
      {hasMore && (
        <li ref={infiniteRef} className="flex justify-center py-4">
          {loadingMore && (
            <Loader2 className="size-6 animate-spin text-[#2555F3]" aria-hidden />
          )}
        </li>
      )}
    </ul>
  );
}
