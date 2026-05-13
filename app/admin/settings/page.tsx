"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type Profile = {
  name: string | null;
  email: string;
  pendingEmail: string | null;
  hasPassword: boolean;
};

type AdminSettingsValues = {
  name: string;
  email: string;
};

function normaliseValues(values: AdminSettingsValues): AdminSettingsValues {
  return {
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
  };
}

function emailFieldFromProfile(p: Profile): string {
  if (p.pendingEmail && p.pendingEmail !== p.email) return p.pendingEmail;
  return p.email;
}

export default function AdminSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [initialValues, setInitialValues] = useState<AdminSettingsValues | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/profile", { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as Profile & {
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Could not load profile.");
          return;
        }
        setProfile(data);
        setName(data.name ?? "");
        const fieldEmail = emailFieldFromProfile(data);
        setEmail(fieldEmail);
        setInitialValues(
          normaliseValues({
            name: data.name ?? "",
            email: fieldEmail,
          }),
        );
      })
      .catch(() => {
        if (!cancelled) setError("Could not load profile.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      } & Partial<Profile>;
      if (!res.ok) {
        setError(data.error ?? "Could not save profile.");
        return;
      }
      const nextProfile: Profile = {
        name: data.name ?? name,
        email: data.email ?? profile?.email ?? "",
        pendingEmail: data.pendingEmail ?? null,
        hasPassword: data.hasPassword ?? profile?.hasPassword ?? false,
      };
      setProfile(nextProfile);
      const fieldEmail = emailFieldFromProfile(nextProfile);
      const nextValues = normaliseValues({
        name: nextProfile.name ?? "",
        email: fieldEmail,
      });
      setInitialValues(nextValues);
      setName(nextValues.name);
      setEmail(fieldEmail);
      if (
        nextProfile.pendingEmail &&
        nextProfile.pendingEmail !== nextProfile.email
      ) {
        setOk(
          `Confirmation link sent to ${nextProfile.pendingEmail}. You can still sign in with ${nextProfile.email} until you confirm.`,
        );
      } else {
        setOk("Profile updated.");
      }
    } catch {
      setError("Could not save profile.");
    } finally {
      setPending(false);
    }
  }

  async function sendPasswordReset() {
    if (!profile?.email) return;
    setPending(true);
    setError(null);
    setOk(null);
    try {
      await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profile.email }),
      });
      setOk(
        profile.hasPassword
          ? "Password reset link sent to your email."
          : "Password setup link sent to your email.",
      );
    } catch {
      setError(
        profile.hasPassword
          ? "Could not send password reset email."
          : "Could not send password setup email.",
      );
    } finally {
      setPending(false);
    }
  }

  const isDirty = useMemo(() => {
    if (!initialValues) return false;
    const current = normaliseValues({ name, email });
    return (
      current.name !== initialValues.name || current.email !== initialValues.email
    );
  }, [initialValues, name, email]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="font-montaga text-2xl text-[#333333]">Account settings</h1>
      <p className="mt-2 font-montserrat text-sm text-[#5E5E5E]">
        Update your admin profile and sign-in email.
      </p>
      <div className="mt-6 space-y-4 rounded-xl border border-[#e5e5e5] bg-white p-5">
        <div>
          <label className="font-montserrat text-sm font-medium text-[#333333]">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-[#e5e5e5] px-3 font-montserrat text-sm"
          />
        </div>
        <div>
          <label className="font-montserrat text-sm font-medium text-[#333333]">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-[#e5e5e5] px-3 font-montserrat text-sm"
          />
          {profile?.pendingEmail &&
          profile.pendingEmail !== profile.email ? (
            <p className="mt-1 font-montserrat text-xs text-[#5E5E5E]">
              Pending: {profile.pendingEmail}. Sign in still uses{" "}
              <span className="font-medium text-[#333333]">{profile.email}</span>{" "}
              until you open the link we sent to the pending address.
            </p>
          ) : (
            <p className="mt-1 font-montserrat text-xs text-[#5E5E5E]">
              Changing your email sends a confirmation link to the new address.
              Your current email stays active for login until you confirm.
            </p>
          )}
        </div>
        {error ? (
          <p className="font-montserrat text-sm text-red-600">{error}</p>
        ) : null}
        {ok ? (
          <p className="font-montserrat text-sm text-emerald-700">{ok}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void save()}
            disabled={pending || !isDirty}
            className="cursor-pointer"
          >
            Save changes
          </Button>
          <Button
            variant="outline"
            onClick={() => void sendPasswordReset()}
            disabled={pending}
            className="cursor-pointer"
          >
            {profile?.hasPassword ? "Reset password" : "Set password"}
          </Button>
        </div>
      </div>
    </div>
  );
}
