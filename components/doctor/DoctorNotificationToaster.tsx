"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { USER_ROLE } from "@/lib/user-role";

type ApiNotification = {
  id: string;
  title: string;
  message: string;
  actorUserId?: string | null;
  createdAt: string;
};

type ToastNotification = ApiNotification & {
  dismissAt: number;
};

const POLL_INTERVAL_MS = 15_000;
const TOAST_TTL_MS = 6_000;

export const DOCTOR_UNREAD_COUNT_EVENT = "doctor-notifications:unread-count";

export function DoctorNotificationToaster() {
  const { data: session, status } = useSession();
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [pendingNavigationToastId, setPendingNavigationToastId] = useState<string | null>(null);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const hasInitializedRef = useRef(false);

  const isDoctor = useMemo(() => {
    return session?.user?.role === USER_ROLE.DOCTOR;
  }, [session?.user?.role]);

  const currentUserId = session?.user?.id ?? null;

  useEffect(() => {
    if (status !== "authenticated" || !isDoctor) {
      seenNotificationIdsRef.current = new Set();
      hasInitializedRef.current = false;
      return;
    }

    let cancelled = false;

    async function loadUnreadNotifications() {
      try {
        const res = await fetch("/api/notifications/unread", { cache: "no-store" });
        if (!res.ok) return;

        const data = (await res.json()) as { notifications?: ApiNotification[] };
        const notifications = Array.isArray(data.notifications) ? data.notifications : [];
        window.dispatchEvent(
          new CustomEvent<number>(DOCTOR_UNREAD_COUNT_EVENT, {
            detail: notifications.length,
          }),
        );

        if (!hasInitializedRef.current) {
          notifications.forEach((notification) => {
            seenNotificationIdsRef.current.add(notification.id);
          });
          hasInitializedRef.current = true;
          return;
        }

        const now = Date.now();
        const newNotifications = [...notifications]
          .reverse()
          .filter((notification) => !seenNotificationIdsRef.current.has(notification.id));

        if (newNotifications.length === 0) return;

        newNotifications.forEach((notification) => {
          seenNotificationIdsRef.current.add(notification.id);
        });

        if (cancelled) return;

        // Suppress toasts for actions the recipient performed themselves.
        // The notification still appears in the notifications panel/history.
        const toastable = newNotifications.filter(
          (notification) =>
            !notification.actorUserId ||
            notification.actorUserId !== currentUserId,
        );

        if (toastable.length === 0) return;

        setToasts((current) => {
          const existingIds = new Set(current.map((toast) => toast.id));
          const additions = toastable
            .filter((notification) => !existingIds.has(notification.id))
            .map((notification) => ({
              ...notification,
              dismissAt: now + TOAST_TTL_MS,
            }));
          return [...current, ...additions];
        });
      } catch {
        // best-effort polling
      }
    }

    void loadUnreadNotifications();
    const interval = setInterval(() => void loadUnreadNotifications(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isDoctor, status, currentUserId]);

  useEffect(() => {
    if (toasts.length === 0) return;

    const now = Date.now();
    const nextDismissAt = Math.min(...toasts.map((toast) => toast.dismissAt));
    const timeoutMs = Math.max(0, nextDismissAt - now);

    const timeout = setTimeout(() => {
      const currentTime = Date.now();
      setToasts((current) => current.filter((toast) => toast.dismissAt > currentTime));
    }, timeoutMs + 50);

    return () => clearTimeout(timeout);
  }, [toasts]);

  if (!isDoctor || status !== "authenticated" || toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-100 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <Link
          key={toast.id}
          href="/doctor/notifications"
          onClick={() => setPendingNavigationToastId(toast.id)}
          className={`pointer-events-auto block rounded-xl border border-[#e5e5e5] bg-white p-4 shadow-lg transition-all hover:bg-[#fafcff] active:scale-[0.99] ${
            pendingNavigationToastId === toast.id ? "opacity-80" : ""
          }`}
          aria-busy={pendingNavigationToastId === toast.id}
        >
          <article role="status" aria-live="polite">
            <p className="font-montserrat text-sm font-semibold text-[#333333]">{toast.title}</p>
            <p className="mt-1 font-montserrat text-sm text-[#5E5E5E]">{toast.message}</p>
            <p className="mt-3 font-montserrat text-xs font-semibold text-[#2555F3]">
              {pendingNavigationToastId === toast.id
                ? "Opening notifications..."
                : "View notifications →"}
            </p>
          </article>
        </Link>
      ))}
    </div>
  );
}
