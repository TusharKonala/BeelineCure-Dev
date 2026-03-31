"use client";

import { useState, type SVGProps } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/patient/dashboard";
  const registered = searchParams.get("registered") === "1";
  const verified = searchParams.get("verified") === "1";
  const reset = searchParams.get("reset") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        if (result.error === "EMAIL_NOT_VERIFIED") {
          setError("Please verify your email before signing in.");
        } else {
          setError("Invalid email or password.");
        }
        return;
      }
      router.push(callbackUrl);
      router.refresh();
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
          Sign in
        </h1>
        <p className="mt-3 font-montserrat text-sm leading-relaxed text-[#5E5E5E] md:text-base">
          Continue with Google or sign in with your email and password.
        </p>
      </div>

      {registered && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 font-montserrat text-sm text-emerald-900">
          Account created. Please verify your email before signing in.
        </p>
      )}

      {verified && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 font-montserrat text-sm text-emerald-900">
          Email verified. You can sign in now.
        </p>
      )}

      {reset && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 font-montserrat text-sm text-emerald-900">
          Password reset successfully. You can sign in now.
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-montserrat text-sm text-red-800">
          {error}
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full cursor-pointer gap-2 rounded-xl border-[#e5e5e5] bg-white font-montserrat text-sm font-medium text-[#333333] shadow-sm hover:bg-[#fafafa] md:h-12 md:text-base"
        onClick={() => void signIn("google", { callbackUrl })}
      >
        <GoogleMark className="size-5 shrink-0" aria-hidden />
        Continue with Google
      </Button>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[#e5e5e5]" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 font-montserrat text-xs font-medium uppercase tracking-wide text-[#5E5E5E]">
            or
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="signin-email"
          className="font-montserrat text-sm font-medium text-[#333333]"
        >
          Email
        </label>
        <input
          id="signin-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClassName}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="signin-password"
          className="font-montserrat text-sm font-medium text-[#333333]"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="signin-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClassName} pr-11`}
          />
          <button
            type="button"
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#5E5E5E] outline-none hover:bg-[#f5f5f5] hover:text-[#333333] focus-visible:ring-2 focus-visible:ring-[#2555F3]/30"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff className="size-4 shrink-0" />
            ) : (
              <Eye className="size-4 shrink-0" />
            )}
          </button>
        </div>
        <div className="text-right">
          <Link
            href="/auth/forgot-password"
            className="font-montserrat text-xs font-medium text-[#2555F3] hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full cursor-pointer rounded-xl bg-[#2555F3] font-montserrat text-sm font-medium hover:bg-[#1e44c7] md:h-12 md:text-base"
      >
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center font-montserrat text-sm text-[#5E5E5E]">
        Don&apos;t have an account?{" "}
        <Link
          href="/auth/signup"
          className="font-medium text-[#2555F3] hover:underline"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}

function GoogleMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...props}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
