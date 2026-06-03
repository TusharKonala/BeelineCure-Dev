"use client";

import { useState } from "react";

const DEMO_ROLES = ["Clinic Owner", "Doctor", "Admin Staff"] as const;

const inputClassName =
  "w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 font-montserrat text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-[#2555F3] focus:ring-[3px] focus:ring-[#2555F3]/20 md:text-base";

const labelClassName =
  "mb-1.5 block font-montserrat text-sm font-medium text-white/80";

export function BeelineCureDemoForm() {
  const [fullName, setFullName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof DEMO_ROLES)[number] | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          clinicName: clinicName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          ...(role ? { role } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to submit request");
      }
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit request",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center md:px-10 md:py-12">
        <p className="font-montserrat text-lg leading-relaxed text-white md:text-xl">
          Thanks! We&apos;ll reach out within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-8 md:px-10 md:py-10">
      <h1 className="font-montaga text-2xl font-semibold text-white md:text-3xl">
        Request a guided demo
      </h1>
      <p className="mt-2 font-montserrat text-sm leading-relaxed text-white/70 md:text-base">
        Tell us about your clinic and we&apos;ll schedule a walkthrough of
        BeelineCure.
      </p>

      {error ? (
        <div
          className="mt-6 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3"
          role="alert"
        >
          <p className="font-montserrat text-sm text-red-200">{error}</p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label htmlFor="fullName" className={labelClassName}>
            Full Name <span className="text-[#2555F3]">*</span>
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            aria-required
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="clinicName" className={labelClassName}>
            Clinic Name <span className="text-[#2555F3]">*</span>
          </label>
          <input
            id="clinicName"
            name="clinicName"
            type="text"
            required
            aria-required
            autoComplete="organization"
            value={clinicName}
            onChange={(e) => setClinicName(e.target.value)}
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="phone" className={labelClassName}>
            Phone Number <span className="text-[#2555F3]">*</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            aria-required
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="email" className={labelClassName}>
            Email <span className="text-[#2555F3]">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            aria-required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="role" className={labelClassName}>
            Role <span className="font-normal text-white/50">(optional)</span>
          </label>
          <select
            id="role"
            name="role"
            value={role}
            onChange={(e) =>
              setRole(e.target.value as (typeof DEMO_ROLES)[number] | "")
            }
            className={`${inputClassName} ${role ? "" : "text-white/40"}`}
          >
            <option value="">Select your role</option>
            {DEMO_ROLES.map((option) => (
              <option
                key={option}
                value={option}
                className="bg-[#171717] text-white"
              >
                {option}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full cursor-pointer rounded-lg bg-[#2555F3] px-6 py-3.5 font-montserrat text-sm font-semibold text-white transition-colors hover:bg-[#1E44C7] disabled:cursor-not-allowed disabled:opacity-60 md:text-base"
        >
          {submitting ? "Sending…" : "Submit request"}
        </button>
      </form>
    </div>
  );
}
