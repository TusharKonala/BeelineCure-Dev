"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Pusher from "pusher-js";
import { Loader2, Send } from "lucide-react";
import { formatMessageTime } from "@/components/chat/format-chat-time";
import { syncGlobalUnreadBadge } from "@/components/chat/useChatInboxPusher";

export const CHAT_UNREAD_COUNT_EVENT = "chat:unread-count";

type ChatMessage = {
  id: string;
  clientId?: string;
  body: string;
  senderUserId: string;
  senderRole: string;
  isOwn: boolean;
  createdAt: string;
  status?: "pending" | "sent" | "failed";
};

const PROVISION_POLL_MS = 2500;
const PROVISION_POLL_MAX = 24;

type ThreadMeta = {
  id: string;
  appointmentId: string;
  peerName: string;
  isReadOnly: boolean;
  isReady: boolean;
};

type ChatThreadViewProps = {
  appointmentId: string;
  backHref: string;
  backLabel?: string;
  className?: string;
};

export function ChatThreadView({
  appointmentId,
  backHref,
  backLabel = "Back to chat",
  className = "",
}: ChatThreadViewProps) {
  const { data: session, status } = useSession();
  const [thread, setThread] = useState<ThreadMeta | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingThread, setLoadingThread] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<string | null>(null);

  const syncUnreadBadge = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/unread-counts", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { total?: number };
      if (typeof data.total === "number") {
        syncGlobalUnreadBadge(data.total);
      }
    } catch {
      // best-effort
    }
  }, []);

  const loadThread = useCallback(async () => {
    const res = await fetch(
      `/api/chat/threads/by-appointment/${encodeURIComponent(appointmentId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      throw new Error("Could not load chat");
    }
    const data = (await res.json()) as { thread?: ThreadMeta };
    if (!data.thread) throw new Error("Chat not found");
    conversationIdRef.current = data.thread.id;
    setThread(data.thread);
    return data.thread;
  }, [appointmentId]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      setLoadingMessages(true);
      try {
        const res = await fetch(
          `/api/chat/threads/${encodeURIComponent(conversationId)}/messages`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { messages?: ChatMessage[] };
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        void syncUnreadBadge();
      } finally {
        setLoadingMessages(false);
      }
    },
    [syncUnreadBadge],
  );

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    async function init() {
      setLoadingThread(true);
      setError(null);
      try {
        const t = await loadThread();
        if (cancelled) return;
        if (t.isReady) {
          void loadMessages(t.id);
        }
      } catch {
        if (!cancelled) setError("Unable to load this chat.");
      } finally {
        if (!cancelled) setLoadingThread(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [status, loadThread, loadMessages]);

  useEffect(() => {
    if (!thread || thread.isReady) return;

    let attempts = 0;
    let cancelled = false;

    const poll = async () => {
      if (cancelled || attempts >= PROVISION_POLL_MAX) return;
      attempts += 1;
      try {
        const t = await loadThread();
        if (cancelled) return;
        if (t.isReady) {
          void loadMessages(t.id);
        }
      } catch {
        // keep polling until max attempts
      }
    };

    const interval = window.setInterval(() => {
      void poll();
    }, PROVISION_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [thread?.isReady, thread?.id, loadThread, loadMessages]);

  useEffect(() => {
    const conversationId = thread?.id;
    const userId = session?.user?.id;
    if (!thread?.isReady || !conversationId || !userId) return;

    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) return;

    const pusher = new Pusher(key, { cluster });
    const channel = pusher.subscribe(`conversation-${conversationId}`);

    const onNewMessage = (payload: {
      id: string;
      body: string;
      senderUserId: string;
      senderRole: string;
      createdAt: string;
    }) => {
      const isOwn = payload.senderUserId === userId;
      if (isOwn) return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.id)) return prev;
        return [
          ...prev,
          {
            id: payload.id,
            body: payload.body,
            senderUserId: payload.senderUserId,
            senderRole: payload.senderRole,
            isOwn,
            createdAt: payload.createdAt,
          },
        ];
      });

      if (!isOwn && document.visibilityState === "visible") {
        void fetch(
          `/api/chat/threads/${encodeURIComponent(conversationId)}/read`,
          { method: "POST" },
        ).then(() => syncUnreadBadge());
      }
    };

    channel.bind("new-message", onNewMessage);

    return () => {
      channel.unbind("new-message", onNewMessage);
      pusher.unsubscribe(`conversation-${conversationId}`);
      pusher.disconnect();
    };
  }, [thread?.isReady, thread?.id, session?.user?.id, syncUnreadBadge]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    const convId = conversationIdRef.current;
    const userId = session?.user?.id;
    if (!text || !convId || !userId || thread?.isReadOnly || sending) return;

    const clientId = crypto.randomUUID();
    const optimistic: ChatMessage = {
      id: clientId,
      clientId,
      body: text,
      senderUserId: userId,
      senderRole: "",
      isOwn: true,
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/chat/threads/${encodeURIComponent(convId)}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string };
        throw new Error(data?.error ?? "Send failed");
      }
      const data = (await res.json()) as { message?: ChatMessage };
      if (data.message) {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientId === clientId
              ? { ...data.message!, status: "sent" as const }
              : m,
          ),
        );
      }
      void syncUnreadBadge();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.clientId !== clientId));
      setDraft(text);
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  if (loadingThread && !thread) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[#2555F3]" aria-hidden />
      </div>
    );
  }

  if (error && !thread) {
    return (
      <div className="rounded-xl border border-[#ffd9d9] bg-[#fff1f1] px-4 py-6 text-center font-montserrat text-sm text-[#b42318]">
        {error}
        <div className="mt-4">
          <Link href={backHref} className="font-medium text-[#2555F3]">
            {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#e5e5e5] bg-white shadow-sm ${className}`}
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-[#e5e5e5] px-4 py-3">
        <Link
          href={backHref}
          className="font-montserrat text-sm font-medium text-[#2555F3] hover:text-[#1e44c7]"
        >
          ← {backLabel}
        </Link>
        <h1 className="flex-1 truncate font-montserrat text-sm font-semibold text-[#333333]">
          {thread?.peerName}
        </h1>
      </div>

      {thread?.isReadOnly && (
        <div
          role="status"
          className="shrink-0 border-b border-[#e5e5e5] bg-[#f5f8ff] px-4 py-2 font-montserrat text-xs text-[#5E5E5E]"
        >
          This chat is read-only — 48 hours have passed since your appointment
          was completed.
        </div>
      )}

      {!thread?.isReady && (
        <div className="shrink-0 border-b border-[#e5e5e5] bg-[#fff9e6] px-4 py-2 font-montserrat text-xs text-[#5E5E5E]">
          Chat is being set up. Please refresh in a moment.
        </div>
      )}

      <div className="relative min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loadingMessages && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
            <Loader2
              className="size-6 animate-spin text-[#2555F3]"
              aria-hidden
            />
          </div>
        )}
        {messages.length === 0 && thread?.isReady && !loadingMessages && (
          <p className="text-center font-montserrat text-sm text-[#9A9A9A]">
            No messages yet. Say hello to start the conversation.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.clientId ?? m.id}
            className={`flex ${m.isOwn ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 font-montserrat text-sm lg:max-w-[min(75%,42rem)] ${
                m.isOwn
                  ? `bg-[#2555F3] text-white${m.status === "pending" ? " opacity-80" : ""}`
                  : "border border-[#e5e5e5] bg-[#fafafa] text-[#333333]"
              }`}
            >
              <p className="whitespace-pre-wrap wrap-break-word">{m.body}</p>
              <p
                className={`mt-1 text-[10px] ${
                  m.isOwn ? "text-white/80" : "text-[#9A9A9A]"
                }`}
              >
                {formatMessageTime(m.createdAt)}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="shrink-0 px-4 pb-2 font-montserrat text-xs text-[#b42318]">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSend}
        className="flex shrink-0 gap-2 border-t border-[#e5e5e5] p-4"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            thread?.isReadOnly
              ? "Chat is closed"
              : thread?.isReady
                ? "Type a message…"
                : "Chat not ready"
          }
          disabled={!thread?.isReady || thread?.isReadOnly || sending}
          className="flex-1 rounded-xl border border-[#e5e5e5] px-4 py-2 font-montserrat text-sm outline-none focus:border-[#2555F3] disabled:bg-[#f5f5f5]"
          maxLength={4000}
        />
        <button
          type="submit"
          disabled={
            !thread?.isReady || thread?.isReadOnly || sending || !draft.trim()
          }
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2555F3] text-white transition-colors hover:bg-[#1e44c7] disabled:opacity-50"
          aria-label="Send message"
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </button>
      </form>
    </div>
  );
}
