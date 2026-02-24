"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="w-full bg-white border-b">
      <nav className="flex h-16 w-full items-center justify-between px-10">
        {/* Left: main logo */}
        <Link href="/" className="flex items-center">
          <Image
            src="/Logo.svg"
            alt="Clinivo logo"
            width={160}
            height={40}
            className="h-8 w-auto"
            priority
          />
        </Link>

        {/* Right: links + Join Us button */}
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
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

          <Button className="flex cursor-pointer items-center gap-2 rounded-full border border-black bg-[#2555F3] px-5 py-2 text-base text-white hover:bg-[#1e44c7]">
            <Image
              src="/fi-sr-megaphone.svg"
              alt="Join Clinivo"
              width={32}
              height={32}
              className="size-4 shrink-0 object-contain"
              quality={100}
              unoptimized
            />
            <span>Join Us</span>
          </Button>
        </div>
      </nav>
    </header>
  );
}
