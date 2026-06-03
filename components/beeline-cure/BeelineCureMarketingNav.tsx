"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/beeline-cure/LogoMark";

const navLinkClass =
  "font-montserrat text-sm font-semibold text-[#5E5E5E] transition-colors hover:text-[#2555F3]";
const navLinkMutedClass = navLinkClass;
const navCtaClass =
  "rounded-lg bg-[#2555F3] px-4 py-2 font-montserrat text-sm font-semibold text-white transition-colors hover:bg-[#1E44C7]";

export function BeelineCureMarketingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-black/10 bg-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-1.5">
        <div className="flex items-center leading-none lg:hidden">
          <LogoMark height={51} priority />
        </div>
        <div className="hidden items-center leading-none lg:flex">
          <LogoMark height={58} priority />
        </div>

        <div className="hidden items-center gap-6 lg:flex">
          <Link href="/" className={navLinkClass}>
            Home
          </Link>
          <Link href="/about" className={navLinkClass}>
            About
          </Link>
          <Link href="/careers" className={navLinkClass}>
            Careers
          </Link>
          <Link href="/auth/signin" className={navLinkMutedClass}>
            Sign In
          </Link>
          <Link href="/patient/overview" className={navLinkMutedClass}>
            Dashboard
          </Link>
          <Link href="/book-appointment" className={navCtaClass}>
            Book Appointment
          </Link>
        </div>

        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 text-[#333333] transition-colors hover:text-[#2555F3] lg:hidden"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <span className="flex flex-col gap-1.5" aria-hidden>
            <span className="block h-0.5 w-4 bg-current" />
            <span className="block h-0.5 w-4 bg-current" />
            <span className="block h-0.5 w-4 bg-current" />
          </span>
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="border-t border-black/10 bg-white px-6 py-3 lg:hidden">
          <div className="flex flex-col gap-4">
            <Link href="/" className={navLinkClass} onClick={closeMobileMenu}>
              Home
            </Link>
            <Link
              href="/about"
              className={navLinkClass}
              onClick={closeMobileMenu}
            >
              About
            </Link>
            <Link
              href="/careers"
              className={navLinkClass}
              onClick={closeMobileMenu}
            >
              Careers
            </Link>
            <Link
              href="/auth/signin"
              className={navLinkMutedClass}
              onClick={closeMobileMenu}
            >
              Sign In
            </Link>
            <Link
              href="/patient/overview"
              className={navLinkMutedClass}
              onClick={closeMobileMenu}
            >
              Dashboard
            </Link>
            <Link
              href="/book-appointment"
              className={`${navCtaClass} text-center`}
              onClick={closeMobileMenu}
            >
              Book Appointment
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
