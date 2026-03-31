"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Unable to process request right now.");
        return;
      }

      setSubmitted(true);
      setEmail("");
    } finally {
      setPending(false);
    }
  }

  const inputClassName =
    "h-11 w-full rounded-xl border border-[#e5e5e5] bg-white px-3 text-sm font-montserrat text-[#333333] shadow-sm outline-none placeholder:text-[#5E5E5E]/70 focus-visible:border-[#2555F3] focus-visible:ring-[3px] focus-visible:ring-[#2555F3]/20";

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-5">
      <div>
        <h1 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
          Forgot password
        </h1>
        <p className="mt-3 font-montserrat text-sm leading-relaxed text-[#5E5E5E] md:text-base">
          Enter your email and we&apos;ll send you a password reset link.
        </p>
      </div>

      {submitted && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 font-montserrat text-sm text-emerald-900">
          If an account exists for this email, a reset link has been sent.
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-montserrat text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <label
          htmlFor="forgot-password-email"
          className="font-montserrat text-sm font-medium text-[#333333]"
        >
          Email
        </label>
        <input
          id="forgot-password-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClassName}
        />
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full cursor-pointer rounded-xl bg-[#2555F3] font-montserrat text-sm font-medium hover:bg-[#1e44c7] md:h-12 md:text-base"
      >
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
