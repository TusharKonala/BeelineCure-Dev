"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, Menu } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  NavLink,
  NavigationProvider,
} from "@/components/nav/NavigationIndicator";
import { PWA_BANNER_DISMISS_KEY } from "@/components/pwa/PwaInstallBanner";

function handleSignOut() {
  try {
    sessionStorage.removeItem(PWA_BANNER_DISMISS_KEY);
  } catch {
    // best-effort
  }
  void signOut({ callbackUrl: "/" });
}

export function Navbar() {
  const { status, data: session } = useSession();
  const isAuthenticated = status === "authenticated";
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  const roleKey = typeof role === "string" ? role.toLowerCase() : "";
  const dashboardHref =
    roleKey === "patient"
      ? "/patient/overview"
      : roleKey === "doctor"
        ? "/doctor/overview"
        : roleKey === "admin"
          ? "/admin/dashboard"
          : "/patient/overview";

  return (
    <NavigationProvider>
      <header className="sticky top-0 z-50 w-full border-b bg-white">
        <nav className="relative mx-auto flex h-16 w-full min-w-0 max-w-7xl items-center justify-between px-3 sm:px-4 md:px-10">
          <NavLink href="/" className="flex items-center">
            <Image
              src="/Logo.svg"
              alt="Clinivo logo"
              width={160}
              height={40}
              className="h-5 w-auto md:h-6"
              priority
            />
          </NavLink>

          <div className="flex min-w-0 shrink items-center gap-3 md:gap-6">
            <div className="hidden items-center gap-6 text-sm font-medium lg:flex">
              <NavLink href="/" className="nav-link">
                Home
              </NavLink>
              <NavLink href="/about" className="nav-link">
                About
              </NavLink>
              <NavLink href="/notice-board" className="nav-link">
                Notice Board
              </NavLink>
              <NavLink href="/careers" className="nav-link">
                Careers
              </NavLink>
              {!isAuthenticated && (
                <NavLink href="/auth/signin" className="nav-link">
                  Sign in
                </NavLink>
              )}
              {isAuthenticated && (
                <>
                  <button
                    type="button"
                    className="nav-link cursor-pointer"
                    onClick={handleSignOut}
                  >
                    Sign out
                  </button>
                  <NavLink href={dashboardHref} className="nav-link">
                    Dashboard
                  </NavLink>
                </>
              )}
            </div>

            <button
              type="button"
              aria-label="Toggle navigation menu"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-[#333333] xl:hidden"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            >
              <Menu className="size-4 md:size-5" />
            </button>

            <Button
              asChild
              className="flex cursor-pointer items-center gap-1 rounded-full border border-black bg-[#2555F3] px-2 py-1 text-xs text-white hover:bg-[#1e44c7] md:gap-2 md:px-5 md:py-2 md:text-base"
            >
              <NavLink href="/book-appointment">
                <CalendarCheck className="size-3 shrink-0 md:size-4" />
                <span>Book Appointment</span>
              </NavLink>
            </Button>
          </div>

          {isMobileMenuOpen && (
            <div className="absolute inset-x-0 top-16 z-50 border-b bg-white px-10 pb-4 pt-3 lg:hidden">
              <div className="flex flex-col gap-3 font-medium">
                <NavLink
                  href="/"
                  className="nav-link"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Home
                </NavLink>
                <NavLink
                  href="/about"
                  className="nav-link"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  About
                </NavLink>
                <NavLink
                  href="/notice-board"
                  className="nav-link"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Notice Board
                </NavLink>
                <NavLink
                  href="/careers"
                  className="nav-link"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Careers
                </NavLink>
                {!isAuthenticated && (
                  <NavLink
                    href="/auth/signin"
                    className="nav-link"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Sign in
                  </NavLink>
                )}
                {isAuthenticated && (
                  <button
                    type="button"
                    className="nav-link text-left"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleSignOut();
                    }}
                  >
                    Sign out
                  </button>
                )}
                {isAuthenticated && (
                  <NavLink
                    href={dashboardHref}
                    className="nav-link text-left"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Dashboard
                  </NavLink>
                )}
              </div>
            </div>
          )}
        </nav>
      </header>
    </NavigationProvider>
  );
}
