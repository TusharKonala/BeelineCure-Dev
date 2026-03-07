"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="w-full bg-white border-b">
      <nav className="relative flex h-16 w-full min-w-0 mx-auto max-w-7xl items-center justify-between px-3 sm:px-4 md:px-10">
        {/* Left: main logo */}
        <Link href="/" className="flex items-center">
          <Image
            src="/Logo.svg"
            alt="Clinivo logo"
            width={160}
            height={40}
            className="h-5 w-auto md:h-6"
            priority
          />
        </Link>

        {/* Right: links + Join Us button */}
        <div className="flex min-w-0 shrink items-center gap-3 md:gap-6">
          <div className="hidden xl:flex items-center gap-6 text-sm font-medium">
            <Link href="/" className="nav-link">
              Home
            </Link>
            <Link href="/about" className="nav-link">
              About
            </Link>
            <Link href="/employers" className="nav-link">
              Employers/Plan Administrators
            </Link>
            <Link href="/support-partners" className="nav-link">
              Support Partners
            </Link>
            <Link href="/physicians-providers" className="nav-link">
              Physicians and Providers
            </Link>
            <Link href="/advisors" className="nav-link">
              Advisors
            </Link>
          </div>

          {/* Mobile hamburger */}
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
            <Link href="/book-appointment">
              <CalendarCheck className="size-3 shrink-0 md:size-4" />
              <span>Book Appointment</span>
            </Link>
          </Button>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="absolute inset-x-0 top-16 z-50 border-b bg-white px-10 pb-4 pt-3 xl:hidden">
            <div className="flex flex-col gap-3 font-medium">
              <Link
                href="/"
                className="nav-link"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                href="/about"
                className="nav-link"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                About
              </Link>
              <Link
                href="/employers"
                className="nav-link"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Employers/Plan Administrators
              </Link>
              <Link
                href="/support-partners"
                className="nav-link"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Support Partners
              </Link>
              <Link
                href="/physicians-providers"
                className="nav-link"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Physicians and Providers
              </Link>
              <Link
                href="/advisors"
                className="nav-link"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Advisors
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
