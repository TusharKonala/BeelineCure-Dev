"use client";

import Link from "next/link";
import { LogoMark } from "@/components/beeline-cure/LogoMark";

export function Footer() {
  return (
    <footer className="border-t-2 border-[#2555F3] bg-[#171717] px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="flex flex-col items-start">
            <LogoMark height={76} naturalWidth />
            <p className="mt-3 max-w-xs font-montserrat text-sm text-white/50">
              Your patients. Your practice. Your terms.
            </p>
            <a
              href="mailto:hello@beelinecure.com"
              className="mt-2 block font-montserrat text-sm text-white/50 transition-colors hover:text-white"
            >
              hello@beelinecure.com
            </a>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:gap-16">
            <div>
              <h4 className="mb-3 font-montserrat text-sm font-semibold text-white">
                Product
              </h4>
              <ul className="space-y-2 font-montserrat text-sm text-white/60">
                <li>
                  <Link
                    href="/#what-your-clinic-gets"
                    className="font-montserrat transition-colors hover:text-white"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#how-it-works"
                    className="transition-colors hover:text-white"
                  >
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link
                    href="/demo"
                    className="transition-colors hover:text-white"
                  >
                    Demo
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 font-montserrat text-sm font-semibold text-white">
                Company
              </h4>
              <ul className="space-y-2 font-montserrat text-sm text-white/60">
                <li>
                  <Link
                    href="/about"
                    className="transition-colors hover:text-white"
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link
                    href="/careers"
                    className="transition-colors hover:text-white"
                  >
                    Careers
                  </Link>
                </li>
                <li>
                  <a
                    href="mailto:hello@beelinecure.com"
                    className="transition-colors hover:text-white"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <p className="mt-6 border-t border-white/10 pt-6 text-center font-montserrat text-sm text-white/40">
          © 2026 BeelineCure. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
