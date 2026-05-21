"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, MessageCircle } from "lucide-react";
import { CHAT_UNREAD_COUNT_EVENT } from "@/components/chat/ChatThreadView";

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

export function ChatListClient({ basePath }: ChatListClientProps) {
  const { status } = useSession();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/threads", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { threads?: ChatThread[] };
      const list = Array.isArray(data.threads) ? data.threads : [];
      setThreads(list);
      const total = list.reduce((sum, t) => sum + (t.unreadCount ?? 0), 0);
      window.dispatchEvent(
        new CustomEvent<number>(CHAT_UNREAD_COUNT_EVENT, {
          detail: total,
        }),
      );
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    void loadThreads();
    const interval = setInterval(() => void loadThreads(), 30_000);
    return () => clearInterval(interval);
  }, [status, loadThreads]);

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
      {threads.map((thread) => (
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
                {thread.unreadCount > 0 && (
                  <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[#2555F3] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    {thread.unreadCount > 99 ? "99+" : thread.unreadCount}
                  </span>
                )}
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
      ))}
    </ul>
  );
}
