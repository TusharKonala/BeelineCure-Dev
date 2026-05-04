"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Calendar, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";
import {
  CURRENCY_LABELS,
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
  currencyForTimezone,
} from "@/lib/currency";
import {
  type ConsultationPriceCentsByDuration,
  DEFAULT_CONSULTATION_PRICE_CENTS_BY_DURATION,
} from "@/lib/doctor-pricing";
import { uploadDoctorPhoto } from "@/lib/uploads/uploadDoctorPhoto";

const DURATION_KEYS = ["15", "30", "45", "60"] as const;
type DurationKey = (typeof DURATION_KEYS)[number];

type DoctorSettings = {
  id: string;
  name: string;
  phone: string | null;
  specialization: string;
  licenseNumber: string;
  yearsExperience: number | null;
  bio: string | null;
  profilePhotoUrl: string;
  timezone: string;
  currency: SupportedCurrency;
  consultationPriceCentsByDuration: ConsultationPriceCentsByDuration;
};

type PriceInputs = Record<DurationKey, string>;

function priceMapToInputs(map: ConsultationPriceCentsByDuration): PriceInputs {
  return {
    "15": (map["15"] / 100).toFixed(2),
    "30": (map["30"] / 100).toFixed(2),
    "45": (map["45"] / 100).toFixed(2),
    "60": (map["60"] / 100).toFixed(2),
  };
}

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
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [photoUploadPending, setPhotoUploadPending] = useState(false);
  const [disconnectPending, setDisconnectPending] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [isCalendarConnected, setIsCalendarConnected] = useState(connected);
  const [priceInputs, setPriceInputs] = useState<PriceInputs>(() =>
    priceMapToInputs(initialDoctor.consultationPriceCentsByDuration),
  );
  const [selectedPhotoPreviewUrl, setSelectedPhotoPreviewUrl] = useState<
    string | null
  >(null);
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null);
  // Sticky flag — once the doctor edits the currency manually, we never
  // overwrite it from a timezone change.
  const isCurrencyManuallySetRef = useRef(false);

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

  useEffect(() => {
    if (!profilePhotoFile) {
      setSelectedPhotoPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(profilePhotoFile);
    setSelectedPhotoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [profilePhotoFile]);

  function handleTimezoneChange(nextTimezone: string) {
    setDoctor((prev) => {
      const next: DoctorSettings = { ...prev, timezone: nextTimezone };
      if (!isCurrencyManuallySetRef.current) {
        next.currency = currencyForTimezone(nextTimezone);
      }
      return next;
    });
  }

  function handleCurrencyChange(nextCurrency: SupportedCurrency) {
    isCurrencyManuallySetRef.current = true;
    setDoctor((prev) => ({ ...prev, currency: nextCurrency }));
  }

  function updatePriceInput(duration: DurationKey, value: string) {
    setPriceInputs((prev) => ({ ...prev, [duration]: value }));
  }

  function normalisePriceInput(duration: DurationKey) {
    const parsed = Number(priceInputs[duration].trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      setPriceInputs((prev) => ({ ...prev, [duration]: parsed.toFixed(2) }));
    }
  }

  async function onSave() {
    setSavePending(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const parsedPrices: ConsultationPriceCentsByDuration = {
        "15": 0,
        "30": 0,
        "45": 0,
        "60": 0,
      };
      for (const duration of DURATION_KEYS) {
        const parsed = Number(priceInputs[duration].trim());
        if (!Number.isFinite(parsed) || parsed <= 0) {
          setSaveError(
            `Please enter a valid price for the ${duration}-minute consultation.`,
          );
          return;
        }
        parsedPrices[duration] = Math.round(parsed * 100);
      }

      const yearsExperience =
        doctor.yearsExperience === null
          ? null
          : Number.isFinite(doctor.yearsExperience)
            ? doctor.yearsExperience
            : null;
      let resolvedProfilePhotoUrl = doctor.profilePhotoUrl;
      if (profilePhotoFile) {
        setPhotoUploadPending(true);
        try {
          resolvedProfilePhotoUrl = await uploadDoctorPhoto(profilePhotoFile);
        } finally {
          setPhotoUploadPending(false);
        }
      }
      const res = await fetch("/api/doctor/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: doctor.name,
          phone: doctor.phone?.trim() ?? "",
          specialization: doctor.specialization,
          licenseNumber: doctor.licenseNumber,
          yearsExperience,
          bio: doctor.bio,
          profilePhotoUrl: resolvedProfilePhotoUrl,
          timezone: doctor.timezone,
          currency: doctor.currency,
          consultationPriceCentsByDuration: parsedPrices,
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
        setProfilePhotoFile(null);
        if (profilePhotoInputRef.current) {
          profilePhotoInputRef.current.value = "";
        }
        setPriceInputs(
          priceMapToInputs(
            json.doctor.consultationPriceCentsByDuration ??
              DEFAULT_CONSULTATION_PRICE_CENTS_BY_DURATION,
          ),
        );
      }
      setSaveSuccess("Settings saved.");
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save settings.");
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
  const selectClassName = `${inputClassName} cursor-pointer appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2220%22%20height%3D%2220%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%23333333%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E")] bg-[length:1rem_1rem] bg-[position:right_0.75rem_center] bg-no-repeat pr-10`;
  const profilePhotoPreviewSrc = selectedPhotoPreviewUrl ?? doctor.profilePhotoUrl;

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
                Phone{" "}
                <span className="font-normal text-[#5E5E5E]">(optional)</span>
              </label>
              <input
                type="tel"
                autoComplete="tel"
                value={doctor.phone ?? ""}
                onChange={(e) =>
                  setDoctor((prev) => ({ ...prev, phone: e.target.value || null }))
                }
                className={inputClassName}
                placeholder="Clinic or mobile number"
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
                Upload profile photo
              </label>
              {profilePhotoPreviewSrc && (
                <div className="mb-1">
                  <Image
                    src={profilePhotoPreviewSrc}
                    alt="Doctor profile photo"
                    width={56}
                    height={56}
                    className="size-14 rounded-lg border border-[#e5e5e5] object-cover"
                  />
                </div>
              )}
              <input
                ref={profilePhotoInputRef}
                name="profilePhotoUpload"
                type="file"
                accept="image/*"
                className="cursor-pointer rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 font-montserrat text-sm text-[#333333] shadow-sm transition-colors file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#2555F3]/10 file:px-3 file:py-1.5 file:font-montserrat file:text-xs file:font-medium file:text-[#2555F3] hover:border-[#d8d8d8] hover:bg-[#fafafa] focus-visible:border-[#2555F3] focus-visible:ring-[3px] focus-visible:ring-[#2555F3]/20"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setSaveError(null);
                  setSaveSuccess(null);
                  setProfilePhotoFile(file);
                }}
              />
              {photoUploadPending && (
                <p className="font-montserrat text-xs text-[#5E5E5E]">
                  Uploading image...
                </p>
              )}
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
                onChange={(e) => handleTimezoneChange(e.target.value)}
                className={selectClassName}
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
                Currency
              </label>
              <select
                value={doctor.currency}
                onChange={(e) =>
                  handleCurrencyChange(e.target.value as SupportedCurrency)
                }
                className={selectClassName}
              >
                {SUPPORTED_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {CURRENCY_LABELS[code]}
                  </option>
                ))}
              </select>
              <p className="font-montserrat text-xs text-[#5E5E5E]">
                Used for displaying prices and charging Stripe payments. Auto-suggested from your timezone — change it any time.
              </p>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="font-montaga text-lg font-semibold text-[#333333] md:text-xl">
              Consultation prices ({doctor.currency})
            </h2>
            <p className="mt-1 font-montserrat text-sm text-[#5E5E5E]">
              Set the price for each available appointment length. All four are required.
            </p>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              {DURATION_KEYS.map((duration) => (
                <div key={duration} className="flex flex-col gap-2">
                  <label className="font-montserrat text-sm font-medium text-[#333333]">
                    {duration}-minute consultation
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={priceInputs[duration]}
                    onChange={(e) => updatePriceInput(duration, e.target.value)}
                    onBlur={() => normalisePriceInput(duration)}
                    className={inputClassName}
                  />
                </div>
              ))}
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
                  {isCalendarConnected
                    ? "Google Calendar is connected — Meet links will be included in online appointments."
                    : "Connect your Google Calendar so online appointments include Meet links."}
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
                      className="cursor-pointer"
                    >
                      {disconnectPending ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => {
                        window.location.href = "/api/auth/google/calendar/connect";
                      }}
                      className="cursor-pointer"
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
            <Button
              type="button"
              onClick={() => void onSave()}
              disabled={savePending || photoUploadPending}
              className="cursor-pointer"
            >
              {savePending
                ? "Saving..."
                : photoUploadPending
                  ? "Uploading photo..."
                  : "Save settings"}
            </Button>
          </div>
        </section>
      </Container>
    </div>
  );
}
