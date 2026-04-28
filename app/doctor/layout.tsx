"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Bell,
  CalendarDays,
  LayoutDashboard,
  Menu,
  Pill,
  Users,
  CalendarClock,
  Settings,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { DOCTOR_UNREAD_COUNT_EVENT } from "@/components/doctor/DoctorNotificationToaster";

type DoctorNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: DoctorNavItem[] = [
  { href: "/doctor/overview", label: "Overview", icon: LayoutDashboard },
  {
    href: "/doctor/my-schedule",
    label: "My Schedule",
    icon: CalendarClock,
  },
  {
    href: "/doctor/appointments",
    label: "Appointments",
    icon: CalendarDays,
  },
  {
    href: "/doctor/prescriptions",
    label: "Prescriptions",
    icon: Pill,
  },
  { href: "/doctor/patients", label: "Patients", icon: Users },
  { href: "/doctor/settings", label: "Settings", icon: Settings },
  {
    href: "/doctor/notifications",
    label: "Notifications",
    icon: Bell,
  },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DoctorLayout({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [doctorDisplayName, setDoctorDisplayName] = useState(
    session?.user?.name?.trim() || "Doctor",
  );
  const lastActivityPingAtRef = useRef(0);
  const doctorName = doctorDisplayName;
  const initials =
    doctorName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "D";

  useEffect(() => {
    if (!session?.user?.id || session.user.role !== "DOCTOR") return;

    const minPingIntervalMs = 5 * 60 * 1000;
    const pingActivity = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastActivityPingAtRef.current < minPingIntervalMs) {
        return;
      }
      lastActivityPingAtRef.current = now;
      try {
        await fetch("/api/doctor/activity", {
          method: "POST",
          cache: "no-store",
        });
      } catch {
        // Intentionally ignore activity heartbeat network errors.
      }
    };

    void pingActivity(true);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void pingActivity();
      }
    };
    const onWindowFocus = () => {
      void pingActivity();
    };
    const interval = window.setInterval(() => {
      void pingActivity();
    }, minPingIntervalMs);

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onWindowFocus);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onWindowFocus);
    };
  }, [session?.user?.id, session?.user?.role]);

  useEffect(() => {
    if (!session?.user?.id || session.user.role !== "DOCTOR") return;
    let cancelled = false;

    async function loadDoctorName() {
      try {
        const res = await fetch("/api/doctor/settings", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          doctor?: { name?: unknown };
        };
        const nextName =
          typeof data.doctor?.name === "string" ? data.doctor.name.trim() : "";
        if (!cancelled && nextName) {
          setDoctorDisplayName(nextName);
        }
      } catch {
        // best-effort name sync for dashboard navbar
      }
    }

    void loadDoctorName();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, session?.user?.role]);

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
    function handleUnreadCountSync(event: Event) {
      const customEvent = event as CustomEvent<number>;
      const nextCount =
        typeof customEvent.detail === "number" && Number.isFinite(customEvent.detail)
          ? Math.max(0, Math.floor(customEvent.detail))
          : 0;
      setUnreadNotificationCount(nextCount);
    }

    window.addEventListener(
      DOCTOR_UNREAD_COUNT_EVENT,
      handleUnreadCountSync as EventListener,
    );
    return () => {
      window.removeEventListener(
        DOCTOR_UNREAD_COUNT_EVENT,
        handleUnreadCountSync as EventListener,
      );
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-[#e5e5e5] bg-white lg:block">
        <div className="px-4 py-6">
          <h2 className="font-montaga text-xl text-[#333333]">Doctor</h2>
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
                  {item.href === "/doctor/notifications" &&
                    unreadNotificationCount > 0 && (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#2555F3] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                        {unreadNotificationCount > 99
                          ? "99+"
                          : unreadNotificationCount}
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
              className="inline-flex items-center gap-0.5 font-montserrat text-sm font-medium text-[#333333] transition-colors hover:text-[#2555F3] md:text-base"
            >
              <span aria-hidden className="mr-1">
                ←
              </span>
              Clinivo Care
            </Link>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-[#333333] lg:hidden"
                aria-label="Open doctor menu"
                onClick={() => setIsMobileMenuOpen((v) => !v)}
              >
                <Menu className="size-5" />
              </button>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2555F3] font-montserrat text-sm font-semibold text-white">
                {initials}
              </div>
              <span className="hidden font-montserrat text-sm font-medium text-[#333333] md:block">
                {doctorName}
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
                    {item.href === "/doctor/notifications" &&
                      unreadNotificationCount > 0 && (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#2555F3] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                          {unreadNotificationCount > 99
                            ? "99+"
                            : unreadNotificationCount}
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
