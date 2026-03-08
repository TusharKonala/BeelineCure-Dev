"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const patientFormSchema = z.object({
  patientName: z.string().min(1, "Full name is required"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email"),
  phone: z.string().min(1, "Phone number is required"),
  notes: z.string().optional(),
});

type PatientFormValues = z.infer<typeof patientFormSchema>;

async function getDoctor(doctorId: string) {
  const res = await fetch(`/api/doctors/${doctorId}`);
  if (!res.ok) throw new Error("Failed to fetch doctor");
  return res.json();
}

async function getSlots(doctorId: string, date: string) {
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

export default function BookAppointmentDoctorPage() {
  const params = useParams();
  const doctorId = String(params?.doctorId ?? "");
  const [selectedDate, setSelectedDate] = useState<string>(() => todayISO());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const minDate = todayISO();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    mode: "onBlur",
    defaultValues: { patientName: "", email: "", phone: "", notes: "" },
  });

  const onPatientFormSubmit = useCallback(
    (data: PatientFormValues) => {
      // TODO: submit appointment (doctorId, selectedDate, selectedSlot, data)
      console.log({ doctorId, selectedDate, selectedSlot, data });
    },
    [doctorId, selectedDate, selectedSlot],
  );

  const { data: doctor, isLoading: doctorLoading } = useQuery({
    queryKey: ["doctor", doctorId],
    queryFn: () => getDoctor(doctorId),
    enabled: !!doctorId,
  });

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

  const slots: string[] = slotsData?.slots ?? [];

  const onDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setSelectedDate(next);
    setSelectedSlot(null);
  }, []);

  const slotsLoadingOrFetching = slotsLoading || slotsFetching;

  return (
    <div className="w-full bg-[#fafafa] py-10 md:py-14 lg:py-16">
      <Container>
        {/* 1. Doctor Summary */}
        <section className="mb-10 md:mb-12">
          <div className="flex flex-col gap-2 text-left">
            <h2 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
              Doctor
            </h2>
          </div>
          {doctorLoading && (
            <div className="mt-4 flex flex-col gap-2">
              <Skeleton className="h-7 w-48 md:h-8" />
              <Skeleton className="h-5 w-36" />
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

        {/* 3. Time Slot Grid */}
        <section>
          <div className="flex flex-col gap-2 text-left">
            <h2 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
              Available times
            </h2>
          </div>

          {slotsLoadingOrFetching && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-xl sm:h-12" />
              ))}
            </div>
          )}

          {!slotsLoadingOrFetching && slots.length === 0 && (
            <p className="mt-6 font-montserrat text-sm text-[#5E5E5E]">
              No slots available for this date.
            </p>
          )}

          {!slotsLoadingOrFetching && slots.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:gap-4">
              {slots.map((time) => (
                <Button
                  key={time}
                  variant={selectedSlot === time ? "default" : "outline"}
                  className="cursor-pointer h-11 rounded-xl font-montserrat text-sm font-medium sm:h-12 md:text-base"
                  onClick={() => setSelectedSlot(time)}
                >
                  {time}
                </Button>
              ))}
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
                <input
                  id="phone"
                  type="tel"
                  {...register("phone")}
                  className="rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 font-montserrat text-sm text-[#111111] shadow-sm focus:border-[#2555F3] focus:outline-none focus:ring-2 focus:ring-[#2555F3]/30 md:py-2.5"
                  placeholder="+1 555-0000"
                />
                {errors.phone && (
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
              <Button
                disabled={!isValid}
                type="submit"
                className="mt-2 w-full cursor-pointer rounded-xl font-montserrat text-sm font-medium sm:px-8"
              >
                Confirm appointment
              </Button>
            </form>
          </section>
        )}
      </Container>
    </div>
  );
}
