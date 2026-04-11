"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignUpForm({
  initialRole = "PATIENT",
}: {
  initialRole?: "PATIENT" | "DOCTOR";
}) {
  const router = useRouter();

  const [role, setRole] = useState<"PATIENT" | "DOCTOR">(initialRole);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [bio, setBio] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [photoUploadPending, setPhotoUploadPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const parsedYearsExperience =
        yearsExperience.trim().length > 0 ? Number(yearsExperience) : undefined;
      if (
        role === "DOCTOR" &&
        parsedYearsExperience != null &&
        !Number.isFinite(parsedYearsExperience)
      ) {
        setError("Years of experience must be a valid number.");
        return;
      }

      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim(),
          password,
          role,
          doctor:
            role === "DOCTOR"
              ? {
                  specialization: specialization.trim(),
                  licenseNumber: licenseNumber.trim(),
                  yearsExperience:
                    parsedYearsExperience != null
                      ? Math.max(0, Math.floor(parsedYearsExperience))
                      : undefined,
                  bio: bio.trim() || undefined,
                  profilePhotoUrl: profilePhotoUrl.trim() || undefined,
                  timezone: timezone.trim(),
                }
              : undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      // After signup we require email verification before credentials login.
      const roleParam = role === "DOCTOR" ? "&role=doctor" : "&role=patient";
      router.push(`/auth/signin?registered=1${roleParam}`);
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
          Create account
        </h1>
        <p className="mt-3 font-montserrat text-sm leading-relaxed text-[#5E5E5E] md:text-base">
          Choose patient or doctor signup to get started.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-montserrat text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <p className="font-montserrat text-sm font-medium text-[#333333]">
          I am signing up as
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`h-11 rounded-xl border font-montserrat text-sm font-medium transition-colors ${
              role === "PATIENT"
                ? "border-[#2555F3] bg-[#2555F3]/10 text-[#2555F3]"
                : "border-[#e5e5e5] bg-white text-[#333333] hover:bg-[#fafafa]"
            }`}
            onClick={() => setRole("PATIENT")}
          >
            Patient
          </button>
          <button
            type="button"
            className={`h-11 rounded-xl border font-montserrat text-sm font-medium transition-colors ${
              role === "DOCTOR"
                ? "border-[#2555F3] bg-[#2555F3]/10 text-[#2555F3]"
                : "border-[#e5e5e5] bg-white text-[#333333] hover:bg-[#fafafa]"
            }`}
            onClick={() => setRole("DOCTOR")}
          >
            Doctor
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="signup-name"
          className="font-montserrat text-sm font-medium text-[#333333]"
        >
          Name <span className="font-normal text-[#5E5E5E]">(optional)</span>
        </label>
        <input
          id="signup-name"
          name="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClassName}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="signup-email"
          className="font-montserrat text-sm font-medium text-[#333333]"
        >
          Email
        </label>
        <input
          id="signup-email"
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
          htmlFor="signup-password"
          className="font-montserrat text-sm font-medium text-[#333333]"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="signup-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
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
        <p className="font-montserrat text-xs text-[#5E5E5E]">
          At least 8 characters.
        </p>
      </div>

      {role === "DOCTOR" && (
        <>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="signup-specialization"
              className="font-montserrat text-sm font-medium text-[#333333]"
            >
              Specialization
            </label>
            <input
              id="signup-specialization"
              name="specialization"
              type="text"
              required
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="signup-timezone"
              className="font-montserrat text-sm font-medium text-[#333333]"
            >
              Clinic timezone
            </label>
            <select
              id="signup-timezone"
              name="timezone"
              required
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={`${inputClassName} cursor-pointer`}
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York</option>
              <option value="America/Chicago">America/Chicago</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Europe/Paris">Europe/Paris</option>
              <option value="Asia/Dubai">Asia/Dubai</option>
              <option value="Asia/Kolkata">Asia/Kolkata</option>
              <option value="Asia/Singapore">Asia/Singapore</option>
              <option value="Australia/Sydney">Australia/Sydney</option>
            </select>
            <p className="font-montserrat text-xs text-[#5E5E5E]">
              Used for your availability and appointment times.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="signup-license"
              className="font-montserrat text-sm font-medium text-[#333333]"
            >
              License number
            </label>
            <input
              id="signup-license"
              name="licenseNumber"
              type="text"
              required
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="signup-years-experience"
              className="font-montserrat text-sm font-medium text-[#333333]"
            >
              Years of experience{" "}
              <span className="font-normal text-[#5E5E5E]">(optional)</span>
            </label>
            <input
              id="signup-years-experience"
              name="yearsExperience"
              type="number"
              min={0}
              max={80}
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="signup-doctor-photo-url"
              className="font-montserrat text-sm font-medium text-[#333333]"
            >
              Profile photo URL
            </label>
            <input
              id="signup-doctor-photo-url"
              name="profilePhotoUrl"
              type="url"
              required
              value={profilePhotoUrl}
              onChange={(e) => setProfilePhotoUrl(e.target.value)}
              className={inputClassName}
              placeholder="https://example.com/doctor-photo.jpg"
            />
            <p className="font-montserrat text-xs text-[#5E5E5E]">
              You can also upload a file below to auto-fill this field.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="signup-doctor-photo-upload"
              className="font-montserrat text-sm font-medium text-[#333333]"
            >
              Upload profile photo
            </label>
            <input
              id="signup-doctor-photo-upload"
              name="profilePhotoUpload"
              type="file"
              accept="image/*"
              className="cursor-pointer rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 font-montserrat text-sm text-[#333333] shadow-sm transition-colors file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#2555F3]/10 file:px-3 file:py-1.5 file:font-montserrat file:text-xs file:font-medium file:text-[#2555F3] hover:border-[#d8d8d8] hover:bg-[#fafafa] focus-visible:border-[#2555F3] focus-visible:ring-[3px] focus-visible:ring-[#2555F3]/20"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void (async () => {
                  setError(null);
                  setPhotoUploadPending(true);
                  try {
                    const formData = new FormData();
                    formData.append("file", file);
                    const res = await fetch("/api/uploads/doctor-photo", {
                      method: "POST",
                      body: formData,
                    });
                    const data = (await res.json().catch(() => ({}))) as {
                      error?: string;
                      url?: string;
                    };
                    if (!res.ok || !data.url) {
                      setError(data.error ?? "Unable to upload profile photo.");
                      return;
                    }
                    setProfilePhotoUrl(data.url);
                  } finally {
                    setPhotoUploadPending(false);
                  }
                })();
              }}
            />
            {photoUploadPending && (
              <p className="font-montserrat text-xs text-[#5E5E5E]">
                Uploading image...
              </p>
            )}
            {!photoUploadPending && profilePhotoUrl && (
              <p className="font-montserrat text-xs text-emerald-700">
                Photo uploaded successfully.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="signup-doctor-bio"
              className="font-montserrat text-sm font-medium text-[#333333]"
            >
              Short bio{" "}
              <span className="font-normal text-[#5E5E5E]">(optional)</span>
            </label>
            <textarea
              id="signup-doctor-bio"
              name="bio"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className={`${inputClassName} h-auto py-2`}
            />
          </div>
        </>
      )}

      <Button
        type="submit"
        disabled={pending || photoUploadPending}
        className="h-11 w-full cursor-pointer rounded-xl bg-[#2555F3] font-montserrat text-sm font-medium hover:bg-[#1e44c7] md:h-12 md:text-base"
      >
        {pending
          ? "Creating account..."
          : photoUploadPending
            ? "Uploading photo..."
            : "Sign up"}
      </Button>

      <p className="text-center font-montserrat text-sm text-[#5E5E5E]">
        Already have an account?{" "}
        <Link
          href="/auth/signin"
          className="font-medium text-[#2555F3] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
