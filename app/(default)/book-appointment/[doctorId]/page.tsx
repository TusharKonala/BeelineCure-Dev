"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import { z } from "zod";
import { Container } from "@/components/layout/Container";
import { PostAppointmentActions } from "@/components/PostAppointmentActions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatTimeInPatientTz,
  formatDateInPatientTz,
  isDoctorTimeInPast,
} from "@/lib/timezone-display";
import {
  coerceSupportedCurrency,
  currencyForTimezone,
  formatPrice,
  type SupportedCurrency,
} from "@/lib/currency";
import {
  parsePriceMap,
  priceCentsForDuration,
  type ConsultationPriceCentsByDuration,
} from "@/lib/doctor-pricing";
import { convertCentsAmount } from "@/lib/fx-rates";

const patientFormSchema = z.object({
  patientName: z.string().min(1, "Full name is required"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email"),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "Invalid phone number"),
  notes: z.string().optional(),
});

type PatientFormValues = z.infer<typeof patientFormSchema>;
type SlotDetail = Awaited<ReturnType<typeof getSlots>>["slotDetails"][number];
type SubmitErrorState = {
  message: string;
  link?: {
    href: string;
    label: string;
  };
} | null;

function renderSubmitErrorMessage(submitError: NonNullable<SubmitErrorState>) {
  if (!submitError.link) return submitError.message;

  const idx = submitError.message.indexOf(submitError.link.label);
  if (idx === -1) return submitError.message;

  const before = submitError.message.slice(0, idx);
  const after = submitError.message.slice(idx + submitError.link.label.length);

  return (
    <>
      {before}
      <Link href={submitError.link.href} className="font-medium underline">
        {submitError.link.label}
      </Link>
      {after}
    </>
  );
}

async function getDoctor(doctorId: string) {
  const res = await fetch(`/api/doctors/${doctorId}`);
  if (!res.ok) throw new Error("Failed to fetch doctor");
  return res.json();
}

async function getSlots(
  doctorId: string,
  date: string,
): Promise<{
  slots: string[];
  slotDetails: {
    startTime: string;
    slotDurationMinutes: number;
    consultationType: "CLINIC" | "ONLINE" | "BOTH";
    availabilityId: string | null;
  }[];
  doctorTimezone: string;
  slotDurationMinutes: number;
}> {
  const res = await fetch(
    `/api/doctors/${doctorId}/slots?date=${encodeURIComponent(date)}`,
  );
  if (!res.ok) throw new Error("Failed to fetch slots");
  return res.json();
}

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function patientCurrencyFromTimezone(): SupportedCurrency {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return currencyForTimezone(timezone);
}

export default function BookAppointmentDoctorPage() {
  const { data: session, status: sessionStatus } = useSession();
  const params = useParams();
  const doctorId = String(params?.doctorId ?? "");
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(() => todayISO());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [consultationType, setConsultationType] = useState<"CLINIC" | "ONLINE">(
    "CLINIC",
  );
  const queryClient = useQueryClient();
  const dateInputRef = useRef<HTMLInputElement>(null);

  const patientTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  const minDate = todayISO();

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isValid },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    // First validation runs on blur; subsequent re-validation happens on every
    // change so existing errors clear (or update) on the next keystroke.
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { patientName: "", email: "", phone: "", notes: "" },
  });

  useEffect(() => {
    if (sessionStatus !== "authenticated" || !session?.user) return;
    const name = (session.user.name ?? "").trim();
    const email = (session.user.email ?? "").trim();
    if (!name && !email) return;

    const current = getValues();
    reset({
      patientName: current.patientName.trim() ? current.patientName : name,
      email: current.email.trim() ? current.email : email,
      phone: current.phone,
      notes: current.notes ?? "",
    });
  }, [sessionStatus, session?.user, reset, getValues]);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    let cancelled = false;
    void fetch("/api/patient/profile", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { phone?: string | null } | null) => {
        if (cancelled || !data?.phone) return;
        const profilePhone = data.phone.trim();
        if (!profilePhone) return;
        const current = getValues();
        if (current.phone.trim()) return;
        reset({
          patientName: current.patientName,
          email: current.email,
          phone: profilePhone,
          notes: current.notes ?? "",
        });
        setPhoneError(
          isValidPhoneNumber(profilePhone)
            ? null
            : "Please enter a valid phone number.",
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionStatus, getValues, reset]);

  const [submitError, setSubmitError] = useState<SubmitErrorState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookedConfirmation, setBookedConfirmation] = useState<{
    doctorName: string;
    appointmentDate: string;
    appointmentTime: string;
    patientName: string;
    patientEmail: string;
    consultationType: "CLINIC" | "ONLINE";
    doctorTimezone: string;
  } | null>(null);
  const [approxEquivalentLabel, setApproxEquivalentLabel] = useState<string | null>(
    null,
  );
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const { data: doctor, isLoading: doctorLoading } = useQuery({
    queryKey: ["doctor", doctorId],
    queryFn: () => getDoctor(doctorId),
    enabled: !!doctorId,
  });
  const doctorCurrency: SupportedCurrency = useMemo(
    () => coerceSupportedCurrency(doctor?.currency),
    [doctor?.currency],
  );
  const doctorPriceMap: ConsultationPriceCentsByDuration = useMemo(
    () => parsePriceMap(doctor?.consultationPriceCentsByDuration),
    [doctor?.consultationPriceCentsByDuration],
  );

  const dateForSlots = selectedDate;
  const {
    data: slotsData,
    isLoading: slotsLoading,
    isFetching: slotsFetching,
  } = useQuery({
    queryKey: ["slots", doctorId, dateForSlots],
    queryFn: () => getSlots(doctorId, dateForSlots),
    enabled: !!doctorId && !!dateForSlots,
  });
  const slotStarts: string[] = slotsData?.slots ?? [];
  const doctorTz = slotsData?.doctorTimezone ?? "UTC";
  const slotDurationMinutes = slotsData?.slotDurationMinutes ?? 30;
  const slotDetailByStart = useMemo<Map<string, SlotDetail>>(
    () =>
      new Map<string, SlotDetail>(
        (slotsData?.slotDetails ?? []).map(
          (detail): [string, SlotDetail] => [detail.startTime, detail],
        ),
      ),
    [slotsData?.slotDetails],
  );
  const selectedSlotDetail = selectedSlot
    ? slotDetailByStart.get(selectedSlot) ?? null
    : null;
  // Default displayed online fee should be the base 15-minute consultation fee
  // until a slot is explicitly selected.
  const selectedSlotDuration =
    selectedSlotDetail?.slotDurationMinutes ?? 15;
  const selectedSlotPriceCents = useMemo(
    () => priceCentsForDuration(doctorPriceMap, selectedSlotDuration),
    [doctorPriceMap, selectedSlotDuration],
  );
  const consultationPriceLabel = useMemo(
    () => formatPrice(selectedSlotPriceCents, doctorCurrency),
    [selectedSlotPriceCents, doctorCurrency],
  );
  const patientCurrency = useMemo(() => patientCurrencyFromTimezone(), []);
  const shouldShowApproxEquivalent =
    !!selectedSlot && patientCurrency !== doctorCurrency;
  const canBookClinic =
    !selectedSlotDetail || selectedSlotDetail.consultationType !== "ONLINE";
  const canBookOnline =
    !selectedSlotDetail || selectedSlotDetail.consultationType !== "CLINIC";
  const selectedConsultationAllowed =
    (consultationType === "CLINIC" && canBookClinic) ||
    (consultationType === "ONLINE" && canBookOnline);

  const onPatientFormSubmit = useCallback(
    async (data: PatientFormValues) => {
      setSubmitError(null);
      setIsSubmitting(true);
      try {
        const doctorTimezone = slotsData?.doctorTimezone ?? "UTC";

        if (consultationType === "CLINIC") {
          const res = await fetch("/api/appointments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              doctorId,
              date: selectedDate,
              time: selectedSlot,
              consultationType,
              availabilityId: selectedSlotDetail?.availabilityId ?? undefined,
              patientName: data.patientName,
              email: data.email,
              phone: data.phone,
              notes: data.notes ?? undefined,
              timezone: doctorTimezone,
              patientTimezone,
            }),
          });

          const json = await res.json().catch(() => ({}));

          if (!res.ok) {
            setSubmitError({
              message:
                typeof json?.error === "string"
                  ? json.error
                  : "Failed to book appointment",
              link:
                json?.link &&
                typeof json.link.href === "string" &&
                typeof json.link.label === "string"
                  ? { href: json.link.href, label: json.link.label }
                  : undefined,
            });
            return;
          }

          setBookedConfirmation({
            doctorName: doctor?.name ?? "Your doctor",
            appointmentDate: selectedDate,
            appointmentTime: selectedSlot ?? "",
            patientName: data.patientName,
            patientEmail: data.email,
            consultationType,
            doctorTimezone,
          });

          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          const bookingSessionRes = await fetch("/api/booking-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              doctorId,
              date: selectedDate,
              time: selectedSlot,
              consultationType,
              availabilityId: selectedSlotDetail?.availabilityId ?? undefined,
              patientName: data.patientName,
              email: data.email,
              phone: data.phone,
              notes: data.notes,
              timezone: doctorTimezone,
              patientTimezone,
            }),
          });

          const bookingSessionJson = await bookingSessionRes
            .json()
            .catch(() => null);

          if (!bookingSessionRes.ok || !bookingSessionJson?.bookingSessionId) {
            setSubmitError({
              message:
                typeof bookingSessionJson?.error === "string"
                  ? bookingSessionJson.error
                  : "Failed to create booking session",
              link:
                bookingSessionJson?.link &&
                typeof bookingSessionJson.link.href === "string" &&
                typeof bookingSessionJson.link.label === "string"
                  ? {
                      href: bookingSessionJson.link.href,
                      label: bookingSessionJson.link.label,
                    }
                  : undefined,
            });
            return;
          }

          const bookingSessionId = String(bookingSessionJson.bookingSessionId);

          router.push(`/book-appointment/review/${bookingSessionId}`);
        }

        queryClient.invalidateQueries({
          queryKey: ["slots", doctorId, selectedDate],
        });

        setSelectedSlot(null);
      } catch {
        setSubmitError({ message: "Network error. Please try again." });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      doctorId,
      selectedDate,
      selectedSlot,
      selectedSlotDetail,
      consultationType,
      doctor?.name,
      slotsData?.doctorTimezone,
      patientTimezone,
      queryClient,
      router,
    ],
  );

  const filteredSlots = slotStarts.filter(
    (s) => !isDoctorTimeInPast(selectedDate, s, doctorTz),
  );
  const filteredDurationLabel = useMemo(() => {
    const durations = [...new Set(
      filteredSlots
        .map((slotStart) => slotDetailByStart.get(slotStart)?.slotDurationMinutes)
        .filter((duration): duration is number => typeof duration === "number"),
    )].sort((a, b) => a - b);
    const labelNoun = filteredSlots.length === 1 ? "appointment" : "appointments";
    if (durations.length === 0) return `${slotDurationMinutes}-minute ${labelNoun}`;
    if (durations.length === 1) return `${durations[0]}-minute ${labelNoun}`;
    return `${durations.join(" / ")}-minute ${labelNoun}`;
  }, [filteredSlots, slotDetailByStart, slotDurationMinutes]);

  useEffect(() => {
    setSubmitError(null);
  }, [selectedDate]);

  useEffect(() => {
    if (!selectedSlotDetail) return;
    if (selectedSlotDetail.consultationType === "CLINIC") {
      setConsultationType("CLINIC");
    } else if (selectedSlotDetail.consultationType === "ONLINE") {
      setConsultationType("ONLINE");
    }
  }, [selectedSlotDetail]);

  useEffect(() => {
    let cancelled = false;
    async function loadApproxEquivalent() {
      setApproxEquivalentLabel(null);
      if (!selectedSlot) return;
      if (!shouldShowApproxEquivalent) return;
      try {
        const convertedCents = await convertCentsAmount(
          selectedSlotPriceCents,
          doctorCurrency,
          patientCurrency,
        );
        if (!cancelled) {
          setApproxEquivalentLabel(
            `(approx ${formatPrice(convertedCents, patientCurrency)})`,
          );
        }
      } catch {
        // Best-effort only: skip conversion if API fails.
      }
    }
    void loadApproxEquivalent();
    return () => {
      cancelled = true;
    };
  }, [
    selectedSlot,
    consultationType,
    shouldShowApproxEquivalent,
    patientCurrency,
    doctorCurrency,
    selectedSlotPriceCents,
    setApproxEquivalentLabel,
  ]);

  const onDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setSelectedDate(next);
    setSelectedSlot(null);
  }, []);

  const slotsLoadingOrFetching = slotsLoading || slotsFetching;
  const phoneInputClassName =
    "h-11 w-full rounded-xl border border-[#e5e5e5] bg-white px-3 text-sm font-montserrat text-[#333333] shadow-sm placeholder:text-[#5E5E5E]/70 focus-within:border-[#2555F3] focus-within:ring-[3px] focus-within:ring-[#2555F3]/20 [&_.PhoneInputInput]:outline-none";

  const confirmationMessage =
    "Your appointment has been confirmed. A confirmation email has been sent to your inbox. Please arrive a few minutes early.";

  return (
    <div className="w-full bg-[#fafafa] py-10 md:py-14 lg:py-16">
      <Container>
        {bookedConfirmation ? (
          <section className="mx-auto max-w-xl">
            <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
              <h2 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
                Appointment confirmed
              </h2>
              <p className="mt-4 font-montserrat text-sm text-[#5E5E5E]">
                {confirmationMessage}
              </p>
              <div className="mt-6 flex flex-col gap-2 rounded-lg bg-[#fafafa] p-4 font-montserrat text-sm">
                <p>
                  <span className="font-medium text-[#111111]">Doctor:</span>{" "}
                  <span className="text-[#333333]">
                    {bookedConfirmation.doctorName}
                  </span>
                </p>
                <p>
                  <span className="font-medium text-[#111111]">Date:</span>{" "}
                  <span className="text-[#333333]">
                    {formatDateInPatientTz(
                      bookedConfirmation.appointmentDate,
                      bookedConfirmation.appointmentTime,
                      bookedConfirmation.doctorTimezone,
                    )}
                  </span>
                </p>
                <p>
                  <span className="font-medium text-[#111111]">Time:</span>{" "}
                  <span className="text-[#333333]">
                    {formatTimeInPatientTz(
                      bookedConfirmation.appointmentDate,
                      bookedConfirmation.appointmentTime,
                      bookedConfirmation.doctorTimezone,
                    )}
                  </span>
                </p>
                <p>
                  <span className="font-medium text-[#111111]">Patient:</span>{" "}
                  <span className="text-[#333333]">
                    {bookedConfirmation.patientName}
                  </span>
                </p>
                <p>
                  <span className="font-medium text-[#111111]">
                    Consultation:
                  </span>{" "}
                  <span className="text-[#333333]">Clinic Visit</span>
                </p>
              </div>
              <PostAppointmentActions emailHint={bookedConfirmation.patientEmail} />
            </div>
          </section>
        ) : (
          <>
            {/* 1. Doctor Summary */}
            <section className="mb-10 md:mb-12">
              <div className="flex flex-col gap-2 text-left">
                <h2 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
                  Doctor
                </h2>
              </div>
              {doctorLoading && (
                <div className="mt-4 flex flex-col gap-2">
                  <Skeleton className="h-7 w-48 md:h-8 bg-[#e5e5e5]" />
                  <Skeleton className="h-5 w-36 bg-[#e5e5e5]" />
                </div>
              )}
              {!doctorLoading && doctor && (
                <div className="mt-4 flex flex-col gap-1">
                  <span className="font-montaga text-lg text-[#111111] md:text-xl">
                    {doctor.name}
                  </span>
                  <span className="font-montserrat text-sm text-[#5E5E5E]">
                    {doctor.specialization}
                  </span>
                </div>
              )}
              {!doctorLoading && !doctor && doctorId && (
                <p className="mt-4 font-montserrat text-sm text-red-600">
                  Doctor not found.
                </p>
              )}
            </section>

            {/* 2. Date Picker */}
            <section className="mb-10 md:mb-12">
              <div className="flex flex-col gap-2 text-left">
                <h2 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
                  Select date
                </h2>
              </div>
              <div
                className="mt-4 inline-block"
                onClick={() => dateInputRef.current?.showPicker()}
              >
                <input
                  ref={dateInputRef}
                  type="date"
                  value={selectedDate}
                  min={minDate}
                  onChange={onDateChange}
                  className="cursor-pointer rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 font-montserrat text-sm text-[#111111] shadow-sm focus:border-[#2555F3] focus:outline-none focus:ring-2 focus:ring-[#2555F3]/30 md:py-2.5"
                  aria-label="Select appointment date"
                />
              </div>
            </section>

            {/* 3. Consultation Type */}
            <section className="mb-10 md:mb-12">
              <div className="flex flex-col gap-2 text-left">
                <h2 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
                  Consultation type
                </h2>
                <p className="font-montserrat text-sm text-[#5E5E5E]">
                  Choose how you would like to meet your doctor.
                </p>
              </div>
              <div className="mt-4  max-w-md grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant={
                    consultationType === "CLINIC" ? "default" : "outline"
                  }
                  className="flex h-11 w-full cursor-pointer items-center justify-center rounded-xl font-montserrat text-sm font-medium sm:h-12 md:text-base"
                  aria-pressed={consultationType === "CLINIC"}
                  disabled={!canBookClinic}
                  onClick={() => setConsultationType("CLINIC")}
                >
                  Clinic Visit
                </Button>
                <Button
                  type="button"
                  variant={
                    consultationType === "ONLINE" ? "default" : "outline"
                  }
                  className="flex h-11 w-full cursor-pointer items-center justify-center rounded-xl font-montserrat text-sm font-medium sm:h-12 md:text-base"
                  aria-pressed={consultationType === "ONLINE"}
                  disabled={!canBookOnline}
                  onClick={() => setConsultationType("ONLINE")}
                >
                  Online Consultation
                </Button>
              </div>
              {selectedSlotDetail && (
                <p className="mt-3 font-montserrat text-sm text-[#5E5E5E]">
                  {selectedSlotDetail.consultationType === "CLINIC"
                    ? "This slot is available for clinic visits only."
                    : selectedSlotDetail.consultationType === "ONLINE"
                      ? "This slot is available for online consultations only."
                      : "This slot supports both clinic and online consultations."}
                </p>
              )}
              <p className="mt-2 font-montserrat text-sm text-[#5E5E5E]">
                {consultationType === "CLINIC"
                  ? `Consultation fee (payable at clinic): ${consultationPriceLabel}${shouldShowApproxEquivalent && approxEquivalentLabel ? ` ${approxEquivalentLabel}` : ""}`
                  : `Online consultation fee: ${consultationPriceLabel}${shouldShowApproxEquivalent && approxEquivalentLabel ? ` ${approxEquivalentLabel}` : ""}`}
              </p>
            </section>

            {/* 4. Time Slot Grid */}
            <section>
              <div className="flex flex-col gap-2 text-left">
                <h2 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
                  Available times
                </h2>
                {!slotsLoadingOrFetching && (
                  <p className="font-montserrat text-sm text-[#5E5E5E]">
                    {filteredDurationLabel}
                  </p>
                )}
              </div>

              {slotsLoadingOrFetching && (
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton
                      key={i}
                      className="h-11 w-full rounded-xl bg-[#e5e5e5] sm:h-12"
                    />
                  ))}
                </div>
              )}

              {!slotsLoadingOrFetching && filteredSlots.length === 0 && (
                <p className="mt-6 font-montserrat text-sm text-[#5E5E5E]">
                  No slots available for this date.
                </p>
              )}

              {!slotsLoadingOrFetching && filteredSlots.length > 0 && (
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:gap-4">
                  {filteredSlots.map((time) => {
                    const detail = slotDetailByStart.get(time);
                    const durationForTile =
                      detail?.slotDurationMinutes ?? slotDurationMinutes;
                    return (
                      <Button
                        key={time}
                        variant={selectedSlot === time ? "default" : "outline"}
                        className="cursor-pointer h-11 rounded-xl font-montserrat text-sm font-medium sm:h-12 md:text-base"
                        onClick={() => setSelectedSlot(time)}
                      >
                        {`${formatTimeInPatientTz(selectedDate, time, doctorTz)} · ${durationForTile} min`}
                      </Button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 4. Patient information form (after slot selected) */}
            {selectedSlot && (
              <section className="mt-10 md:mt-12">
                <div className="flex flex-col gap-2 text-left">
                  <h2 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
                    Patient information
                  </h2>
                  <p className="font-montserrat text-sm text-[#5E5E5E]">
                    Selected slot:{" "}
                    {`${formatTimeInPatientTz(selectedDate, selectedSlot, doctorTz)} · ${selectedSlotDuration} min`}
                  </p>
                </div>
                <form
                  onSubmit={handleSubmit(onPatientFormSubmit)}
                  className="mt-6 flex max-w-xl flex-col gap-5"
                >
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="patientName"
                      className="font-montserrat text-sm font-medium text-[#111111]"
                    >
                      Full Name
                    </label>
                    <input
                      id="patientName"
                      type="text"
                      {...register("patientName")}
                      className="rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 font-montserrat text-sm text-[#111111] shadow-sm focus:border-[#2555F3] focus:outline-none focus:ring-2 focus:ring-[#2555F3]/30 md:py-2.5"
                      placeholder="Enter your full name"
                    />
                    {errors.patientName && (
                      <p className="font-montserrat text-sm text-red-600">
                        {errors.patientName.message}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="email"
                      className="font-montserrat text-sm font-medium text-[#111111]"
                    >
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      {...register("email")}
                      className="rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 font-montserrat text-sm text-[#111111] shadow-sm focus:border-[#2555F3] focus:outline-none focus:ring-2 focus:ring-[#2555F3]/30 md:py-2.5"
                      placeholder="you@example.com"
                    />
                    {errors.email && (
                      <p className="font-montserrat text-sm text-red-600">
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="phone"
                      className="font-montserrat text-sm font-medium text-[#111111]"
                    >
                      Phone Number
                    </label>
                    <Controller
                      control={control}
                      name="phone"
                      render={({ field }) => (
                        <PhoneInput
                          id="phone"
                          international
                          defaultCountry="US"
                          value={field.value || undefined}
                          onChange={(value) => {
                            field.onChange(value ?? "");
                            setPhoneError(null);
                          }}
                          onBlur={() => {
                            field.onBlur();
                            const trimmed = (getValues("phone") ?? "").trim();
                            if (!trimmed) {
                              setPhoneError("Phone number is required.");
                              return;
                            }
                            setPhoneError(
                              isValidPhoneNumber(trimmed)
                                ? null
                                : "Please enter a valid phone number.",
                            );
                          }}
                          className={phoneInputClassName}
                        />
                      )}
                    />
                    {phoneError ? (
                      <p className="font-montserrat text-sm text-red-600">{phoneError}</p>
                    ) : null}
                    {errors.phone && !phoneError && (
                      <p className="font-montserrat text-sm text-red-600">
                        {errors.phone.message}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="notes"
                      className="font-montserrat text-sm font-medium text-[#111111]"
                    >
                      Notes <span className="text-[#5E5E5E]">(optional)</span>
                    </label>
                    <textarea
                      id="notes"
                      rows={3}
                      {...register("notes")}
                      className="rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 font-montserrat text-sm text-[#111111] shadow-sm focus:border-[#2555F3] focus:outline-none focus:ring-2 focus:ring-[#2555F3]/30 md:py-2.5"
                      placeholder="Any additional notes for the doctor"
                    />
                    {errors.notes && (
                      <p className="font-montserrat text-sm text-red-600">
                        {errors.notes.message}
                      </p>
                    )}
                  </div>
                  {submitError && (
                    <p className="font-montserrat text-sm text-red-600">
                      {renderSubmitErrorMessage(submitError)}
                    </p>
                  )}
                  <Button
                    disabled={
                      !isValid ||
                      isSubmitting ||
                      !selectedConsultationAllowed ||
                      Boolean(phoneError)
                    }
                    type="submit"
                    className="mt-2 w-full cursor-pointer rounded-xl font-montserrat text-sm font-medium sm:px-8"
                  >
                    {isSubmitting
                      ? "Booking…"
                      : consultationType === "ONLINE"
                        ? "Continue to payment"
                        : "Confirm appointment"}
                  </Button>
                </form>
              </section>
            )}
          </>
        )}
      </Container>
    </div>
  );
}
