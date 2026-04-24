"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Calendar, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";

type DoctorSettings = {
  id: string;
  name: string;
  specialization: string;
  licenseNumber: string;
  yearsExperience: number | null;
  bio: string | null;
  profilePhotoUrl: string;
  timezone: string;
  consultationPriceCents: number;
};

export function DoctorSettingsClient({
  initialDoctor,
  connected,
}: {
  initialDoctor: DoctorSettings;
  connected: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const calendarStatus = searchParams.get("calendar");
  const [doctor, setDoctor] = useState(initialDoctor);
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [disconnectPending, setDisconnectPending] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [isCalendarConnected, setIsCalendarConnected] = useState(connected);

  const banner = useMemo(() => {
    if (calendarStatus === "connected") {
      return {
        tone: "success" as const,
        message:
          "Google Calendar connected. Online appointments will include a Meet link.",
      };
    }
    if (calendarStatus === "denied") {
      return {
        tone: "warning" as const,
        message: "Google Calendar connection was cancelled. You can try again any time.",
      };
    }
    if (calendarStatus === "error") {
      return {
        tone: "error" as const,
        message: "We could not finish connecting Google Calendar. Please try again.",
      };
    }
    return null;
  }, [calendarStatus]);

  async function onSave() {
    setSavePending(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const yearsExperience =
        doctor.yearsExperience === null
          ? null
          : Number.isFinite(doctor.yearsExperience)
            ? doctor.yearsExperience
            : null;
      const res = await fetch("/api/doctor/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: doctor.name,
          specialization: doctor.specialization,
          licenseNumber: doctor.licenseNumber,
          yearsExperience,
          bio: doctor.bio,
          profilePhotoUrl: doctor.profilePhotoUrl,
          timezone: doctor.timezone,
          consultationPriceCents: doctor.consultationPriceCents,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        doctor?: DoctorSettings;
      };
      if (!res.ok) {
        setSaveError(json.error ?? "Failed to save settings.");
        return;
      }
      if (json.doctor) {
        setDoctor(json.doctor);
      }
      setSaveSuccess("Settings saved.");
      router.refresh();
    } finally {
      setSavePending(false);
    }
  }

  async function onDisconnect() {
    setDisconnectPending(true);
    setDisconnectError(null);
    try {
      const res = await fetch("/api/doctor/google-calendar/disconnect", {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setDisconnectError(data.error ?? "Unable to disconnect. Please try again.");
        return;
      }
      setIsCalendarConnected(false);
      router.refresh();
    } finally {
      setDisconnectPending(false);
    }
  }

  const inputClassName =
    "h-11 w-full rounded-xl border border-[#e5e5e5] bg-white px-3 text-sm font-montserrat text-[#333333] shadow-sm outline-none placeholder:text-[#5E5E5E]/70 focus-visible:border-[#2555F3] focus-visible:ring-[3px] focus-visible:ring-[#2555F3]/20";

  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <section className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
          <h1 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
            Settings
          </h1>

          {banner && (
            <div
              className={`mt-6 flex items-start gap-2 rounded-xl border px-3 py-2 font-montserrat text-sm ${
                banner.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : banner.tone === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {banner.tone === "success" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              )}
              <p>{banner.message}</p>
            </div>
          )}

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="font-montserrat text-sm font-medium text-[#333333]">
                Name
              </label>
              <input
                value={doctor.name}
                onChange={(e) => setDoctor((prev) => ({ ...prev, name: e.target.value }))}
                className={inputClassName}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-montserrat text-sm font-medium text-[#333333]">
                Specialization
              </label>
              <input
                value={doctor.specialization}
                onChange={(e) =>
                  setDoctor((prev) => ({ ...prev, specialization: e.target.value }))
                }
                className={inputClassName}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-montserrat text-sm font-medium text-[#333333]">
                License number
              </label>
              <input
                value={doctor.licenseNumber}
                onChange={(e) =>
                  setDoctor((prev) => ({ ...prev, licenseNumber: e.target.value }))
                }
                className={inputClassName}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-montserrat text-sm font-medium text-[#333333]">
                Years of experience
              </label>
              <input
                type="number"
                min={0}
                max={80}
                value={doctor.yearsExperience ?? ""}
                onChange={(e) =>
                  setDoctor((prev) => ({
                    ...prev,
                    yearsExperience: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className={inputClassName}
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="font-montserrat text-sm font-medium text-[#333333]">
                Profile photo URL
              </label>
              <input
                value={doctor.profilePhotoUrl}
                onChange={(e) =>
                  setDoctor((prev) => ({ ...prev, profilePhotoUrl: e.target.value }))
                }
                className={inputClassName}
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="font-montserrat text-sm font-medium text-[#333333]">
                Short bio
              </label>
              <textarea
                rows={4}
                value={doctor.bio ?? ""}
                onChange={(e) => setDoctor((prev) => ({ ...prev, bio: e.target.value }))}
                className={`${inputClassName} h-auto py-2`}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-montserrat text-sm font-medium text-[#333333]">
                Clinic timezone
              </label>
              <select
                value={doctor.timezone}
                onChange={(e) => setDoctor((prev) => ({ ...prev, timezone: e.target.value }))}
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
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-montserrat text-sm font-medium text-[#333333]">
                Consultation price (USD)
              </label>
              <input
                type="number"
                min={1}
                step={0.01}
                value={(doctor.consultationPriceCents / 100).toFixed(2)}
                onChange={(e) =>
                  setDoctor((prev) => ({
                    ...prev,
                    consultationPriceCents: Math.max(
                      100,
                      Math.round(Number(e.target.value || "0") * 100),
                    ),
                  }))
                }
                className={inputClassName}
              />
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-[#e5e5e5] bg-white p-5 md:p-6">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#2555F3]/10 text-[#2555F3]">
                <Calendar className="size-5" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-montaga text-lg font-semibold text-[#333333] md:text-xl">
                    Google Calendar
                  </h2>
                  {isCalendarConnected ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-montserrat text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="size-3" />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-[#fafafa] px-2 py-0.5 font-montserrat text-xs font-medium text-[#5E5E5E]">
                      Not connected
                    </span>
                  )}
                </div>
                <p className="mt-2 font-montserrat text-sm text-[#5E5E5E]">
                  Connect your Google Calendar so online appointments include Meet links.
                </p>
                {disconnectError && (
                  <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-montserrat text-sm text-red-800">
                    {disconnectError}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {isCalendarConnected ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void onDisconnect()}
                      disabled={disconnectPending}
                    >
                      {disconnectPending ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => {
                        window.location.href = "/api/auth/google/calendar/connect";
                      }}
                    >
                      Connect Google Calendar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {saveError && (
            <p className="mt-6 font-montserrat text-sm text-red-600">{saveError}</p>
          )}
          {saveSuccess && (
            <p className="mt-6 font-montserrat text-sm text-emerald-700">
              {saveSuccess}
            </p>
          )}

          <div className="mt-6">
            <Button type="button" onClick={() => void onSave()} disabled={savePending}>
              {savePending ? "Saving..." : "Save settings"}
            </Button>
          </div>
        </section>
      </Container>
    </div>
  );
}
