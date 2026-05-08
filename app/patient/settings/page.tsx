"use client";

import { useEffect, useState } from "react";
import PhoneInput from "react-phone-number-input";
import { Button } from "@/components/ui/button";

type Profile = {
  name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
};

export default function PatientSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/patient/profile", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: Profile) => {
        if (cancelled) return;
        setProfile(data);
        setName(data.name ?? "");
        setPhone(data.phone ?? "");
        setAddress(data.address ?? "");
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
      const res = await fetch("/api/patient/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, address }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      } & Partial<Profile>;
      if (!res.ok) {
        setError(data.error ?? "Could not save profile.");
        return;
      }
      setOk("Profile updated.");
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
      setOk("Password reset link sent to your email.");
    } catch {
      setError("Could not send password reset email.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="font-montaga text-2xl text-[#333333]">Account settings</h1>
      <p className="mt-2 font-montserrat text-sm text-[#5E5E5E]">
        Update your profile and contact details.
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
            disabled
            value={profile?.email ?? ""}
            className="mt-1 h-11 w-full rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 font-montserrat text-sm text-[#5E5E5E]"
          />
          <p className="mt-1 font-montserrat text-xs text-[#5E5E5E]">
            Email is linked to your appointment history and cannot be changed
            here.
          </p>
        </div>
        <div>
          <label className="font-montserrat text-sm font-medium text-[#333333]">
            Phone (optional)
          </label>
          <PhoneInput
            international
            defaultCountry="US"
            value={phone || undefined}
            onChange={(value) => setPhone(value ?? "")}
            className="mt-1 h-11 rounded-xl border border-[#e5e5e5] px-3 font-montserrat text-sm"
          />
        </div>
        <div>
          <label className="font-montserrat text-sm font-medium text-[#333333]">
            Address (optional)
          </label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-[#e5e5e5] px-3 font-montserrat text-sm"
          />
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
            disabled={pending}
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
            Change password
          </Button>
        </div>
      </div>
    </div>
  );
}
