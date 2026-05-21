"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Loader2, Send } from "lucide-react";

export const CHAT_UNREAD_COUNT_EVENT = "chat:unread-count";

type ChatMessage = {
  id: string;
  body: string;
  senderUserId: string;
  senderRole: string;
  isOwn: boolean;
  createdAt: string;
};

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
};

export function ChatThreadView({
  appointmentId,
  backHref,
  backLabel = "Back to chat",
}: ChatThreadViewProps) {
  const { status } = useSession();
  const [thread, setThread] = useState<ThreadMeta | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<string | null>(null);

  const syncUnreadBadge = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/unread-counts", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { total?: number };
      window.dispatchEvent(
        new CustomEvent<number>(CHAT_UNREAD_COUNT_EVENT, {
          detail: typeof data.total === "number" ? data.total : 0,
        }),
      );
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
      const res = await fetch(
        `/api/chat/threads/${encodeURIComponent(conversationId)}/messages`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { messages?: ChatMessage[] };
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      void syncUnreadBadge();
    },
    [syncUnreadBadge],
  );

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const t = await loadThread();
        if (cancelled) return;
        if (t.isReady) {
          await loadMessages(t.id);
        }
      } catch {
        if (!cancelled) setError("Unable to load this chat.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [status, loadThread, loadMessages]);

  useEffect(() => {
    if (!thread?.isReady || !conversationIdRef.current) return;
    if (thread?.isReadOnly) return;

    const poll = () => {
      if (document.visibilityState !== "visible") return;
      void loadMessages(conversationIdRef.current!);
    };

    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [thread?.isReady, thread?.isReadOnly, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    const convId = conversationIdRef.current;
    if (!text || !convId || thread?.isReadOnly || sending) return;

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
        setMessages((prev) => [...prev, data.message!]);
      }
      setDraft("");
      void syncUnreadBadge();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
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
    <div className="flex min-h-[calc(100vh-8rem)] flex-col rounded-xl border border-[#e5e5e5] bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-[#e5e5e5] px-4 py-3">
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
          className="border-b border-[#e5e5e5] bg-[#f5f8ff] px-4 py-2 font-montserrat text-xs text-[#5E5E5E]"
        >
          This chat is read-only — 48 hours have passed since your appointment
          was completed.
        </div>
      )}

      {!thread?.isReady && (
        <div className="border-b border-[#e5e5e5] bg-[#fff9e6] px-4 py-2 font-montserrat text-xs text-[#5E5E5E]">
          Chat is being set up. Please refresh in a moment.
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && thread?.isReady && (
          <p className="text-center font-montserrat text-sm text-[#9A9A9A]">
            No messages yet. Say hello to start the conversation.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.isOwn ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 font-montserrat text-sm ${
                m.isOwn
                  ? "bg-[#2555F3] text-white"
                  : "border border-[#e5e5e5] bg-[#fafafa] text-[#333333]"
              }`}
            >
              <p className="whitespace-pre-wrap wrap-break-word">{m.body}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="px-4 pb-2 font-montserrat text-xs text-[#b42318]">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSend}
        className="flex gap-2 border-t border-[#e5e5e5] p-4"
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
