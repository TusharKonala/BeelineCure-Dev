"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Pusher from "pusher-js";
import { ImageIcon, Loader2, Send } from "lucide-react";
import { formatMessageTime } from "@/components/chat/format-chat-time";
import { syncGlobalUnreadBadge } from "@/components/chat/useChatInboxPusher";

const SCROLL_NEAR_BOTTOM_PX = 80;

type ChatMessage = {
  id: string;
  clientId?: string;
  body: string;
  senderUserId: string;
  senderRole: string;
  isOwn: boolean;
  createdAt: string;
  status?: "pending" | "sent" | "failed";
  messageType?: string;
  localImageUrl?: string;
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingSendCount, setPendingSendCount] = useState(0);
  const [hasNewMessagesBelow, setHasNewMessagesBelow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<string | null>(null);
  const scrollRestoreRef = useRef<{ height: number; top: number } | null>(null);
  const loadingMoreRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const didInitialScrollRef = useRef(false);

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

  const updateNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const near =
      el.scrollTop + el.clientHeight >=
      el.scrollHeight - SCROLL_NEAR_BOTTOM_PX;
    isNearBottomRef.current = near;
    if (near) {
      setHasNewMessagesBelow(false);
    }
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
    isNearBottomRef.current = true;
    setHasNewMessagesBelow(false);
  }, []);

  const loadThreadWithMessages = useCallback(async () => {
    const res = await fetch(
      `/api/chat/threads/by-appointment/${encodeURIComponent(appointmentId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      throw new Error("Could not load chat");
    }
    const data = (await res.json()) as {
      thread?: ThreadMeta;
      messages?: ChatMessage[];
      hasMore?: boolean;
    };
    if (!data.thread) throw new Error("Chat not found");
    conversationIdRef.current = data.thread.id;
    setThread(data.thread);
    setMessages(Array.isArray(data.messages) ? data.messages : []);
    setHasMoreOlder(Boolean(data.hasMore));
    void syncUnreadBadge();
    return data.thread;
  }, [appointmentId, syncUnreadBadge]);

  const loadOlderMessages = useCallback(async () => {
    const convId = conversationIdRef.current;
    if (!convId || loadingMoreRef.current || !hasMoreOlder) return;

    const oldest = messages[0];
    if (!oldest) return;

    loadingMoreRef.current = true;

    const scrollEl = scrollContainerRef.current;
    if (scrollEl) {
      scrollRestoreRef.current = {
        height: scrollEl.scrollHeight,
        top: scrollEl.scrollTop,
      };
    }

    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        before: oldest.createdAt,
      });
      const res = await fetch(
        `/api/chat/threads/${encodeURIComponent(convId)}/messages?${params}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;

      const data = (await res.json()) as {
        messages?: ChatMessage[];
        hasMore?: boolean;
      };
      const older = Array.isArray(data.messages) ? data.messages : [];
      setHasMoreOlder(Boolean(data.hasMore));

      if (older.length === 0) {
        setHasMoreOlder(false);
        return;
      }

      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const unique = older.filter((m) => !seen.has(m.id));
        return [...unique, ...prev];
      });
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [messages, hasMoreOlder]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    async function init() {
      setLoadingInitial(true);
      setError(null);
      setHasMoreOlder(false);
      didInitialScrollRef.current = false;
      try {
        await loadThreadWithMessages();
      } catch {
        if (!cancelled) setError("Unable to load this chat.");
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [status, loadThreadWithMessages]);

  useLayoutEffect(() => {
    const restore = scrollRestoreRef.current;
    if (!restore) return;

    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) {
      scrollRestoreRef.current = null;
      return;
    }

    scrollEl.scrollTop =
      scrollEl.scrollHeight - restore.height + restore.top;
    scrollRestoreRef.current = null;
    updateNearBottom();
  }, [messages, updateNearBottom]);

  useEffect(() => {
    if (loadingInitial || didInitialScrollRef.current) return;
    if (messages.length === 0) return;
    didInitialScrollRef.current = true;
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [loadingInitial, messages.length, scrollToBottom]);

  useEffect(() => {
    const root = scrollContainerRef.current;
    const sentinel = topSentinelRef.current;
    if (!root || !sentinel || loadingInitial) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadOlderMessages();
        }
      },
      { root, rootMargin: "80px 0px 0px 0px", threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadOlderMessages, loadingInitial, hasMoreOlder]);

  useEffect(() => {
    const conversationId = thread?.id;
    const userId = session?.user?.id;
    if (!conversationId || !userId) return;

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
      messageType?: string;
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
            messageType: payload.messageType,
          },
        ];
      });

      if (isNearBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom("smooth"));
      } else {
        setHasNewMessagesBelow(true);
      }

      if (document.visibilityState === "visible") {
        void fetch(
          `/api/chat/threads/${encodeURIComponent(conversationId)}/read`,
          { method: "POST" },
        ).then(() => syncUnreadBadge());
      } else {
        void syncUnreadBadge();
      }
    };

    channel.bind("new-message", onNewMessage);

    return () => {
      channel.unbind("new-message", onNewMessage);
      pusher.unsubscribe(`conversation-${conversationId}`);
      pusher.disconnect();
    };
  }, [thread?.id, session?.user?.id, syncUnreadBadge, scrollToBottom]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    const convId = conversationIdRef.current;
    const userId = session?.user?.id;
    if (!text || !convId || !userId || thread?.isReadOnly) return;

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
    setPendingSendCount((n) => n + 1);
    setError(null);
    requestAnimationFrame(() => scrollToBottom("smooth"));

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
      setPendingSendCount((n) => Math.max(0, n - 1));
    }
  }

  const imageInputRef = useRef<HTMLInputElement>(null);

  async function handleImageSend(file: File) {
    const convId = conversationIdRef.current;
    const userId = session?.user?.id;
    if (!convId || !userId || thread?.isReadOnly) return;

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError("Only JPEG, PNG, and WebP images are allowed.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Image must be 10MB or smaller.");
      return;
    }

    const localUrl = URL.createObjectURL(file);
    const clientId = crypto.randomUUID();
    const optimistic: ChatMessage = {
      id: clientId,
      clientId,
      body: "",
      senderUserId: userId,
      senderRole: "",
      isOwn: true,
      createdAt: new Date().toISOString(),
      status: "pending",
      messageType: "image",
      localImageUrl: localUrl,
    };

    setMessages((prev) => [...prev, optimistic]);
    setPendingSendCount((n) => n + 1);
    setError(null);
    requestAnimationFrame(() => scrollToBottom("smooth"));

    try {
      const urlRes = await fetch("/api/chat/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convId,
          contentType: file.type,
        }),
      });
      if (!urlRes.ok) {
        const d = (await urlRes.json().catch(() => null)) as { error?: string };
        throw new Error(d?.error ?? "Failed to get upload URL");
      }
      const { uploadUrl, key } = (await urlRes.json()) as {
        uploadUrl: string;
        key: string;
      };

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error("Image upload failed");
      }

      const msgRes = await fetch(
        `/api/chat/threads/${encodeURIComponent(convId)}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: "",
            messageType: "image",
            imageKey: key,
          }),
        },
      );
      if (!msgRes.ok) {
        const d = (await msgRes.json().catch(() => null)) as { error?: string };
        throw new Error(d?.error ?? "Failed to send image message");
      }
      const data = (await msgRes.json()) as { message?: ChatMessage };
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
      setError(err instanceof Error ? err.message : "Failed to send image");
    } finally {
      URL.revokeObjectURL(localUrl);
      setPendingSendCount((n) => Math.max(0, n - 1));
    }
  }

  const inputDisabled = loadingInitial || !thread || thread.isReadOnly;

  if (loadingInitial && !thread) {
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
      className={`flex h-full w-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#e5e5e5] bg-white shadow-sm ${className}`}
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

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollContainerRef}
          onScroll={updateNearBottom}
          className="absolute inset-0 space-y-3 overflow-y-auto px-4 py-4 sm:px-6"
        >
          <div ref={topSentinelRef} className="h-px w-full shrink-0" aria-hidden />
          {(loadingMore || (hasMoreOlder && messages.length > 0)) && (
            <div className="flex justify-center py-2">
              {loadingMore ? (
                <Loader2
                  className="size-5 animate-spin text-[#2555F3]"
                  aria-label="Loading older messages"
                />
              ) : (
                <span className="font-montserrat text-xs text-[#9A9A9A]">
                  Scroll up for older messages
                </span>
              )}
            </div>
          )}
          {messages.length === 0 && thread && !loadingInitial && (
            <p className="text-center font-montserrat text-sm text-[#9A9A9A]">
              No messages yet. Say hello to start the conversation.
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.clientId ?? m.id}
              className={`flex ${m.isOwn ? "justify-end pr-4" : "justify-start pl-4"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 font-montserrat text-sm lg:max-w-[min(75%,42rem)] ${
                  m.isOwn
                    ? `bg-[#2555F3] text-white${m.status === "pending" ? " opacity-80" : ""}`
                    : "border border-[#e5e5e5] bg-[#fafafa] text-[#333333]"
                }`}
              >
                {m.messageType === "image" ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        m.status === "pending" && m.localImageUrl
                          ? m.localImageUrl
                          : `/api/chat/image/${m.id}`
                      }
                      alt="Shared image"
                      className="max-h-64 w-auto rounded-xl object-contain"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = "none";
                        const fallback = target.nextElementSibling;
                        if (fallback instanceof HTMLElement) fallback.style.display = "block";
                      }}
                    />
                    <p className="hidden italic opacity-70" aria-hidden>
                      Image failed to load
                    </p>
                  </>
                ) : (
                  <p className="whitespace-pre-wrap wrap-break-word">{m.body}</p>
                )}
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

        {hasNewMessagesBelow && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <button
              type="button"
              onClick={() => scrollToBottom("smooth")}
              className="pointer-events-auto rounded-full border border-[#e5e5e5] bg-white px-4 py-2 font-montserrat text-sm font-medium text-[#2555F3] shadow-md transition-colors hover:bg-[#f5f8ff]"
            >
              New message ↓
            </button>
          </div>
        )}
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
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImageSend(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={inputDisabled}
          onClick={() => imageInputRef.current?.click()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e5e5e5] text-[#5E5E5E] transition-colors hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Send image"
        >
          <ImageIcon className="size-4" />
        </button>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={thread?.isReadOnly ? "Chat is closed" : "Type a message…"}
          disabled={inputDisabled}
          className="flex-1 rounded-xl border border-[#e5e5e5] px-4 py-2 font-montserrat text-sm outline-none focus:border-[#2555F3] disabled:cursor-not-allowed disabled:bg-[#f5f5f5] disabled:text-[#9A9A9A]"
          maxLength={4000}
        />
        <button
          type="submit"
          disabled={inputDisabled || !draft.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2555F3] text-white transition-colors hover:bg-[#1e44c7] disabled:opacity-50"
          aria-label="Send message"
        >
          {pendingSendCount > 0 ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </button>
      </form>
    </div>
  );
}
