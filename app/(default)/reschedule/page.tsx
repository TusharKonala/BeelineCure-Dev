"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/skeleton";
import { ConsultationType, AppointmentStatus } from "@/generated/prisma/client";
import {
  formatTimeInPatientTz,
  formatDateInPatientTz,
  isDoctorTimeInPast,
} from "@/lib/timezone-display";

type RescheduleUiState =
  | "idle"
  | "success"
  | "invalid_link"
  | "invalid_body"
  | "already_cancelled"
  | "error";

type AppointmentDetails = {
  id: string;
  doctorId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  timezone: string;
  consultationType: ConsultationType;
  status: AppointmentStatus;
};

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

async function fetchAppointmentDetails(
  appointmentId: string,
  token: string,
): Promise<
  | { status: "success"; appointment: AppointmentDetails }
  | { status: "invalid_link" }
  | { status: "already_cancelled" }
> {
  const res = await fetch(
    `/api/reschedule-appointment?appointmentId=${encodeURIComponent(
      appointmentId,
    )}&token=${encodeURIComponent(token)}`,
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) return { status: "invalid_link" as const };
  return json;
}

async function getSlots(
  doctorId: string,
  date: string,
  excludeAppointmentId: string,
): Promise<{ slots: string[]; doctorTimezone: string }> {
  const res = await fetch(
    `/api/doctors/${doctorId}/slots?date=${encodeURIComponent(
      date,
    )}&excludeAppointmentId=${encodeURIComponent(excludeAppointmentId)}`,
  );
  if (!res.ok) throw new Error("Failed to fetch slots");
  return res.json();
}

function RescheduleContent() {
  const searchParams = useSearchParams();
  const appointmentId = useMemo(
    () => searchParams.get("appointmentId") ?? "",
    [searchParams],
  );
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const canLoad = appointmentId.length > 0 && token.length > 0;

  const [state, setState] = useState<RescheduleUiState>("idle");
  const [isLoadingAppointment, setIsLoadingAppointment] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [appointment, setAppointment] = useState<AppointmentDetails | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [hasSelectionInteraction, setHasSelectionInteraction] = useState(false);

  useEffect(() => {
    if (!canLoad) return;

    setIsLoadingAppointment(true);
    setSubmitError(null);

    fetchAppointmentDetails(appointmentId, token)
      .then((json) => {
        if (json.status === "success") {
          setAppointment(json.appointment);
          setSelectedDate(json.appointment.date);
          setSelectedSlot(json.appointment.time);
          setHasSelectionInteraction(false);
          setState("idle");
          return;
        }

        setAppointment(null);
        setState(json.status);
      })
      .catch(() => setState("error"))
      .finally(() => setIsLoadingAppointment(false));
  }, [appointmentId, token, canLoad]);

  const selectedDoctorId = appointment?.doctorId ?? "";
  const slotsEnabled = state === "idle" && !!selectedDoctorId && !!selectedDate;

  const isCurrentAppointmentSlot =
    !!appointment &&
    !!selectedDate &&
    !!selectedSlot &&
    selectedDate === appointment.date &&
    selectedSlot === appointment.time;
  const shouldBlockCurrentAppointmentSlot =
    hasSelectionInteraction && isCurrentAppointmentSlot;

  const {
    data: slotsData,
    isLoading: slotsLoading,
    isFetching: slotsFetching,
  } = useQuery({
    queryKey: ["reschedule-slots", selectedDoctorId, selectedDate],
    enabled: slotsEnabled,
    queryFn: () =>
      getSlots(selectedDoctorId, selectedDate, appointment?.id ?? ""),
  });

  const slots = slotsData?.slots ?? [];
  const doctorTz = slotsData?.doctorTimezone ?? appointment?.timezone ?? "UTC";
  const slotsLoadingOrFetching = slotsLoading || slotsFetching;

  const filteredSlots = slots.filter(
    (s) => !isDoctorTimeInPast(selectedDate, s, doctorTz),
  );

  const onDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setHasSelectionInteraction(true);
    setSelectedDate(e.target.value);
    setSelectedSlot(null);
    setSubmitError(null);
  }, []);

  const onConfirmReschedule = async () => {
    if (!canLoad || state !== "idle") return;
    if (!selectedDate || !selectedSlot || isSubmitting) return;
    if (isCurrentAppointmentSlot) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/reschedule-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          token,
          date: selectedDate,
          time: selectedSlot,
        }),
      });

      const json = (await res.json().catch(() => null)) as {
        status?: string;
      } | null;

      const nextState = json?.status;
      if (nextState === "success") {
        setState("success");
        return;
      }

      if (
        nextState === "already_cancelled" ||
        nextState === "invalid_link" ||
        nextState === "invalid_body"
      ) {
        setState(nextState);
        return;
      }

      if (nextState === "slot_unavailable") {
        setSubmitError(
          "That time slot is no longer available. Please choose another.",
        );
        return;
      }

      setState("error");
    } catch {
      setState("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = (() => {
    switch (state) {
      case "success":
        return "Appointment Rescheduled";
      case "already_cancelled":
        return "Already Cancelled";
      case "invalid_link":
        return "Invalid Reschedule Link";
      case "invalid_body":
        return "Invalid Request";
      case "error":
        return "Reschedule Error";
      default:
        return "Reschedule Appointment";
    }
  })();

  const message = (() => {
    switch (state) {
      case "success":
        return "Your appointment has been rescheduled.";
      case "already_cancelled":
        return "This appointment has been cancelled and can’t be rescheduled.";
      case "invalid_link":
        return "This reschedule link is invalid or expired.";
      case "invalid_body":
        return "Invalid request. Please try again.";
      case "error":
        return "We could not reschedule your appointment. Please try again.";
      default:
        return "Select a new date and time, then confirm rescheduling.";
    }
  })();

  return (
    <div className="w-full bg-[#fafafa] py-10 md:py-14 lg:py-16">
      <Container>
        <section className="mx-auto max-w-xl">
          <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
            <h1 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
              {title}
            </h1>
            <p className="mt-4 font-montserrat text-sm text-[#5E5E5E] md:text-base">
              {message}
            </p>

            {state === "success" && selectedDate && selectedSlot && (
              <div className="mt-6 flex flex-col gap-2 rounded-lg bg-[#fafafa] p-4 font-montserrat text-sm text-[#111111]">
                <p>
                  <span className="font-medium text-[#111111]">New date:</span>{" "}
                  <span className="text-[#333333]">
                    {formatDateInPatientTz(selectedDate, selectedSlot, doctorTz)}
                  </span>
                </p>
                <p>
                  <span className="font-medium text-[#111111]">New time:</span>{" "}
                  <span className="text-[#333333]">
                    {formatTimeInPatientTz(selectedDate, selectedSlot, doctorTz)}
                  </span>
                </p>
                <p className="mt-1 text-[#5E5E5E]">
                  A confirmation email has been sent with your updated appointment details.
                </p>
              </div>
            )}

            {state === "idle" && !canLoad && (
              <div className="mt-8">
                <p className="font-montserrat text-sm text-red-600">
                  This reschedule link is missing required parameters.
                </p>
              </div>
            )}

            {state === "idle" && canLoad && (
              <>
                {isLoadingAppointment && (
                  <div className="mt-8">
                    <h2 className="font-montaga text-xl font-semibold leading-tight text-[#333333]">
                      Loading reschedule…
                    </h2>
                    <p className="mt-2 font-montserrat text-sm text-[#5E5E5E]">
                      Please wait.
                    </p>
                  </div>
                )}

                {!isLoadingAppointment && appointment && (
                  <>
                    <div className="mt-8 flex flex-col gap-6">
                      <section>
                        <h2 className="font-montaga text-xl font-semibold leading-tight text-[#333333]">
                          Select date
                        </h2>
                        <div className="mt-4 inline-block">
                          <input
                            type="date"
                            value={selectedDate}
                            min={todayISO()}
                            onChange={onDateChange}
                            className="cursor-pointer rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 font-montserrat text-sm text-[#111111] shadow-sm focus:border-[#2555F3] focus:outline-none focus:ring-2 focus:ring-[#2555F3]/30 md:py-2.5"
                            aria-label="Select appointment date"
                          />
                        </div>
                      </section>

                      <section>
                        <h2 className="font-montaga text-xl font-semibold leading-tight text-[#333333]">
                          Available times
                        </h2>

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
                            {filteredSlots.map((time) => (
                              <Button
                                key={time}
                                variant={
                                  selectedSlot === time ? "default" : "outline"
                                }
                                className="cursor-pointer h-11 rounded-xl font-montserrat text-sm font-medium sm:h-12 md:text-base"
                                onClick={() => {
                                  setHasSelectionInteraction(true);
                                  setSelectedSlot(time);
                                  setSubmitError(null);
                                }}
                              >
                                {formatTimeInPatientTz(selectedDate, time, doctorTz)}
                              </Button>
                            ))}
                          </div>
                        )}
                      </section>

                      <section>
                        {submitError && (
                          <p className="mb-4 font-montserrat text-sm text-red-600">
                            {submitError}
                          </p>
                        )}
                        {shouldBlockCurrentAppointmentSlot && (
                          <p className="mb-4 font-montserrat text-sm text-[#5E5E5E]">
                            This is your current appointment slot.
                          </p>
                        )}
                        <Button
                          disabled={
                            !selectedDate ||
                            !selectedSlot ||
                            isSubmitting ||
                            isCurrentAppointmentSlot
                          }
                          onClick={onConfirmReschedule}
                          className="h-11 w-full cursor-pointer rounded-xl font-montserrat text-sm font-medium sm:h-12 md:text-base"
                        >
                          {isSubmitting
                            ? "Rescheduling…"
                            : "Confirm Reschedule"}
                        </Button>
                      </section>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </section>
      </Container>
    </div>
  );
}

export default function ReschedulePage() {
  return (
    <Suspense
      fallback={
        <div className="w-full bg-[#fafafa] py-10 md:py-14 lg:py-16">
          <Container>
            <section className="mx-auto max-w-xl">
              <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
                <h1 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
                  Loading rescheduling…
                </h1>
                <p className="mt-4 font-montserrat text-sm text-[#5E5E5E] md:text-base">
                  Please wait.
                </p>
              </div>
            </section>
          </Container>
        </div>
      }
    >
      <RescheduleContent />
    </Suspense>
  );
}
