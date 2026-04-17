"use client";

import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import useInfiniteScroll from "react-infinite-scroll-hook";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
};

const POLL_INTERVAL_MS = 15_000;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function DoctorNotificationsClient() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newNotificationsCount, setNewNotificationsCount] = useState(0);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const loadPage = useCallback(async (nextPage: number, append: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/doctor/notifications?page=${nextPage}&limit=10`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setError("Failed to load notifications.");
        return;
      }
      const data = (await res.json()) as {
        items?: NotificationItem[];
        hasMore?: boolean;
      };
      const nextItems = Array.isArray(data.items) ? data.items : [];
      setHasMore(Boolean(data.hasMore));
      setPage(nextPage);
      setItems((current) => (append ? [...current, ...nextItems] : nextItems));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(1, false);
  }, [loadPage]);

  useEffect(() => {
    seenIdsRef.current = new Set(items.map((item) => item.id));
  }, [items]);

  useEffect(() => {
    let cancelled = false;

    async function pollUnreadNotifications() {
      try {
        const res = await fetch("/api/notifications/unread", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { notifications?: NotificationItem[] };
        const unread = Array.isArray(data.notifications) ? data.notifications : [];
        const additions = unread.filter((notification) => !seenIdsRef.current.has(notification.id));
        if (additions.length === 0 || cancelled) return;

        additions.forEach((notification) => {
          seenIdsRef.current.add(notification.id);
        });
        setItems((current) => [...additions, ...current]);
        setNewNotificationsCount((current) => current + additions.length);
      } catch {
        // best-effort live updates
      }
    }

    const interval = setInterval(() => void pollUnreadNotifications(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const [sentryRef] = useInfiniteScroll({
    loading: isLoading,
    hasNextPage: hasMore,
    onLoadMore: () => void loadPage(page + 1, true),
    disabled: false,
    rootMargin: "0px 0px 300px 0px",
  });

  return (
    <section className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
            Notifications
          </h1>
          <p className="mt-2 font-montserrat text-sm text-[#5E5E5E]">
            Stay up to date on overdue appointments and follow-up actions.
          </p>
        </div>
      </div>

      {newNotificationsCount > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#2555F3]/25 bg-[#2555F3]/8 px-3 py-2">
          <p className="font-montserrat text-xs font-medium text-[#2555F3] sm:text-sm">
            {newNotificationsCount} new notification
            {newNotificationsCount === 1 ? "" : "s"} received
          </p>
          <button
            type="button"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              setNewNotificationsCount(0);
            }}
            className="cursor-pointer font-montserrat text-xs font-semibold text-[#2555F3] hover:underline"
          >
            View latest
          </button>
        </div>
      )}

      {error ? (
        <div className="mt-8 rounded-xl border border-dashed border-[#e5e5e5] bg-[#fcfcfc] p-8 text-center">
          <p className="font-montserrat text-sm font-medium text-[#333333]">{error}</p>
        </div>
      ) : !isLoading && items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-[#e5e5e5] bg-[#fcfcfc] p-8 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#f5f5f5] text-[#5E5E5E]">
            <Bell className="size-5" aria-hidden />
          </div>
          <p className="mt-3 font-montserrat text-sm font-semibold text-[#333333]">
            No notifications yet
          </p>
          <p className="mt-1 font-montserrat text-sm text-[#5E5E5E]">
            Overdue appointment reminders will appear here.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((notification) => (
            <li
              key={notification.id}
              className="rounded-xl border border-[#e5e5e5] bg-white p-4 transition-colors"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="w-full min-w-0">
                  <p className="wrap-break-word font-montserrat text-sm font-semibold text-[#333333]">
                    {notification.title}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap wrap-break-word font-montserrat text-sm leading-relaxed text-[#333333]">
                    {notification.message}
                  </p>
                </div>
                <time className="shrink-0 whitespace-nowrap font-montserrat text-xs text-[#9A9A9A] sm:pt-0.5">
                  {formatDateTime(notification.createdAt)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(hasMore || isLoading) && (
        <div ref={sentryRef} className="py-4 text-center font-montserrat text-sm text-[#5E5E5E]">
          {isLoading ? "Loading..." : "Scroll for more"}
        </div>
      )}
    </section>
  );
}
