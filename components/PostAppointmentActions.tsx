"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

const APPOINTMENTS_HREF = "/patient/appointments";
const AUTH_SIGNIN_HREF = "/auth/signin";

export function PostAppointmentActions() {
  const { status } = useSession();

  if (status === "loading") {
    return <div className="mt-8 h-10" aria-hidden />;
  }

  if (status === "authenticated") {
    return (
      <div className="mt-8">
        <Button
          asChild
          className="h-11 w-full cursor-pointer rounded-xl font-montserrat text-sm font-medium sm:h-12 md:text-base"
        >
          <Link href={APPOINTMENTS_HREF}>View all appointments</Link>
        </Button>
      </div>
    );
  }

  return (
    <p className="mt-8 font-montserrat text-sm leading-relaxed text-[#5E5E5E]">
      Want to track your appointments?{" "}
      <Link
        href={AUTH_SIGNIN_HREF}
        className="font-medium text-[#2555F3] underline underline-offset-2 hover:text-[#1a45d9]"
      >
        Sign in or create an account
      </Link>
    </p>
  );
}
