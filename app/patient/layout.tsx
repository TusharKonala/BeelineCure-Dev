"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Bell,
  CalendarDays,
  HeartPulse,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Menu,
} from "lucide-react";
import { ChatInboxRealtime } from "@/components/chat/ChatInboxRealtime";
import { CHAT_UNREAD_COUNT_EVENT } from "@/lib/chat-events";
import { Container } from "@/components/layout/Container";
import { PATIENT_UNREAD_COUNT_EVENT } from "@/components/patient/PatientNotificationToaster";

type PatientNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: PatientNavItem[] = [
  { href: "/patient/overview", label: "Overview", icon: LayoutDashboard },
  {
    href: "/patient/appointments",
    label: "Appointments",
    icon: CalendarDays,
  },
  {
    href: "/patient/chat",
    label: "Chat",
    icon: MessageCircle,
  },
  {
    href: "/patient/health-profile",
    label: "Health Profile",
    icon: HeartPulse,
  },
  {
    href: "/patient/notifications",
    label: "Notifications",
    icon: Bell,
  },
  {
    href: "/patient/settings",
    label: "Settings",
    icon: Settings,
  },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function PatientLayout({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const patientName = session?.user?.name?.trim() || "Patient";
  const initials =
    patientName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "P";

  useEffect(() => {
    let cancelled = false;

    async function loadUnreadCount() {
      try {
        const res = await fetch("/api/notifications/unread-count", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { count?: unknown };
        const nextCount =
          typeof data.count === "number" && Number.isFinite(data.count)
            ? Math.max(0, Math.floor(data.count))
            : 0;
        if (!cancelled) setUnreadNotificationCount(nextCount);
      } catch {
        // best-effort badge fetch
      }
    }

    void loadUnreadCount();
    const interval = setInterval(() => void loadUnreadCount(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    async function loadUnreadChatCount() {
      try {
        const res = await fetch("/api/chat/unread-counts", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { total?: unknown };
        const nextCount =
          typeof data.total === "number" && Number.isFinite(data.total)
            ? Math.max(0, Math.floor(data.total))
            : 0;
        if (!cancelled) setUnreadChatCount(nextCount);
      } catch {
        // best-effort
      }
    }

    void loadUnreadChatCount();
    const interval = setInterval(() => void loadUnreadChatCount(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pathname]);

  useEffect(() => {
    function handleNotificationUnread(event: Event) {
      const customEvent = event as CustomEvent<number>;
      const nextCount =
        typeof customEvent.detail === "number" && Number.isFinite(customEvent.detail)
          ? Math.max(0, Math.floor(customEvent.detail))
          : 0;
      setUnreadNotificationCount(nextCount);
    }

    function handleChatUnread(event: Event) {
      const customEvent = event as CustomEvent<number>;
      const nextCount =
        typeof customEvent.detail === "number" && Number.isFinite(customEvent.detail)
          ? Math.max(0, Math.floor(customEvent.detail))
          : 0;
      setUnreadChatCount(nextCount);
    }

    window.addEventListener(
      PATIENT_UNREAD_COUNT_EVENT,
      handleNotificationUnread as EventListener,
    );
    window.addEventListener(
      CHAT_UNREAD_COUNT_EVENT,
      handleChatUnread as EventListener,
    );
    return () => {
      window.removeEventListener(
        PATIENT_UNREAD_COUNT_EVENT,
        handleNotificationUnread as EventListener,
      );
      window.removeEventListener(
        CHAT_UNREAD_COUNT_EVENT,
        handleChatUnread as EventListener,
      );
    };
  }, []);

  return (
    <div className="min-h-svh bg-[#fafafa]">
      <ChatInboxRealtime />
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-[#e5e5e5] bg-white lg:block">
        <div className="px-4 py-6">
          <h2 className="font-montaga text-xl text-[#333333]">Patient</h2>
          <nav className="mt-6 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 font-montserrat text-sm transition-colors ${
                    active
                      ? "bg-[#2555F3] text-white"
                      : "text-[#5E5E5E] hover:bg-[#f5f5f5] hover:text-[#333333]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {item.href === "/patient/notifications" &&
                    unreadNotificationCount > 0 && (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#2555F3] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                        {unreadNotificationCount > 99
                          ? "99+"
                          : unreadNotificationCount}
                      </span>
                    )}
                  {item.href === "/patient/chat" && unreadChatCount > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#2555F3] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                      {unreadChatCount > 99 ? "99+" : unreadChatCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-10 border-b border-[#e5e5e5] bg-white lg:left-64">
        <Container>
          <div className="flex h-14 items-center justify-between">
            <Link
              href="/"
              className="touch-target -ml-2 inline-flex items-center gap-0.5 font-montserrat text-sm font-medium text-[#333333] transition-colors hover:text-[#2555F3] md:text-base"
            >
              <span aria-hidden className="mr-1">
                ←
              </span>
              BeelineCure
            </Link>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-[#333333] lg:hidden"
                aria-label="Open patient menu"
                onClick={() => setIsMobileMenuOpen((v) => !v)}
              >
                <Menu className="size-5" />
              </button>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2555F3] font-montserrat text-sm font-semibold text-white">
                {initials}
              </div>
              <span className="font-montserrat text-sm font-medium text-[#333333] hidden md:block">
                {patientName}
              </span>
            </div>
          </div>
        </Container>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed left-0 right-0 top-14 z-30 border-b border-[#e5e5e5] bg-white lg:hidden">
          <div className="mx-auto max-w-7xl px-4 py-3">
            <div className="flex flex-col gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 font-montserrat text-sm transition-colors ${
                      active
                        ? "bg-[#2555F3] text-white"
                        : "text-[#5E5E5E] hover:bg-[#f5f5f5] hover:text-[#333333]"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="size-4 shrink-0" />
                      {item.label}
                    </span>
                    {item.href === "/patient/notifications" &&
                      unreadNotificationCount > 0 && (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#2555F3] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                          {unreadNotificationCount > 99
                            ? "99+"
                            : unreadNotificationCount}
                        </span>
                      )}
                    {item.href === "/patient/chat" && unreadChatCount > 0 && (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#2555F3] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                        {unreadChatCount > 99 ? "99+" : unreadChatCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <main className="pb-8 pt-20 lg:ml-64 lg:pb-8 lg:pt-14">{children}</main>
    </div>
  );
}
