import { prisma } from "@/lib/db";
import { publicDoctorByIdWhere } from "@/lib/doctor-visibility";
import {
  coerceAllowedSlotDurationMinutes,
  expandAvailabilityRowsDetailed,
  slotSupportsPatientConsultationChoice,
  type PatientConsultationChoice,
} from "@/lib/doctor-availability-slots";
import { isDoctorTimeInPast } from "@/lib/timezone-display";
import { AppointmentStatus } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

const HORIZON_DAYS = 120;

function dateKeyUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ doctorId: string }> },
) {
  const { doctorId } = await params;

  const choiceParam = request.nextUrl.searchParams.get("consultationType");
  let consultationFilter: PatientConsultationChoice | null = null;
  if (choiceParam !== null && choiceParam !== "") {
    if (choiceParam !== "CLINIC" && choiceParam !== "ONLINE") {
      return NextResponse.json(
        { error: "consultationType must be CLINIC or ONLINE" },
        { status: 400 },
      );
    }
    consultationFilter = choiceParam;
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + HORIZON_DAYS);

  const doctor = await prisma.doctor.findFirst({
    where: publicDoctorByIdWhere(doctorId),
    select: { timezone: true, slotDurationMinutes: true },
  });

  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  const [availabilities, appointments] = await Promise.all([
    prisma.doctorAvailability.findMany({
      where: {
        doctorId,
        date: { gte: today, lte: end },
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        slotDurationMinutes: true,
        consultationType: true,
      },
    }),
    prisma.appointment.findMany({
      where: {
        doctorId,
        date: { gte: today, lte: end },
        status: { not: AppointmentStatus.CANCELLED },
      },
      select: { date: true, time: true },
    }),
  ]);

  const bookedByDay = new Map<string, Set<string>>();
  for (const appt of appointments) {
    const key = dateKeyUtc(appt.date);
    if (!bookedByDay.has(key)) bookedByDay.set(key, new Set());
    bookedByDay.get(key)!.add(appt.time);
  }

  const rowsByDay = new Map<
    string,
    {
      id: string;
      startTime: string;
      endTime: string;
      slotDurationMinutes: number;
      consultationType: "CLINIC" | "ONLINE" | "BOTH";
    }[]
  >();

  for (const row of availabilities) {
    const key = dateKeyUtc(row.date);
    const list = rowsByDay.get(key);
    const mapped = {
      id: row.id,
      startTime: row.startTime,
      endTime: row.endTime,
      slotDurationMinutes: row.slotDurationMinutes,
      consultationType: row.consultationType,
    };
    if (list) list.push(mapped);
    else rowsByDay.set(key, [mapped]);
  }

  const fallback = coerceAllowedSlotDurationMinutes(doctor.slotDurationMinutes);
  const tz = doctor.timezone;
  const datesWithSlots: string[] = [];

  for (const [dayKey, rows] of rowsByDay) {
    let slotDetails = expandAvailabilityRowsDetailed(rows, fallback);
    if (consultationFilter) {
      slotDetails = slotDetails.filter((d) =>
        slotSupportsPatientConsultationChoice(
          d.consultationType,
          consultationFilter,
        ),
      );
    }
    const slots = [...new Set(slotDetails.map((s) => s.startTime))].sort();
    const booked = bookedByDay.get(dayKey) ?? new Set<string>();
    const available = slots.filter((s) => !booked.has(s));
    const hasBookableFuture = available.some(
      (start) => !isDoctorTimeInPast(dayKey, start, tz),
    );
    if (hasBookableFuture) datesWithSlots.push(dayKey);
  }

  datesWithSlots.sort();

  return NextResponse.json({ dates: datesWithSlots });
}
