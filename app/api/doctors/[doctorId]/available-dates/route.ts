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

/** Default booking horizon when `from`/`to` are omitted (matches client initial chunk). */
const DEFAULT_HORIZON_DAYS = 60;
/** Max inclusive calendar-day span for a single request when `from`/`to` are provided. */
const MAX_RANGE_INCLUSIVE_DAYS = 35;

function dateKeyUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseYmdUtc(value: string | null): Date | null {
  if (value === null || value === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function inclusiveDaySpan(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
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

  const fromParam = request.nextUrl.searchParams.get("from");
  const toParam = request.nextUrl.searchParams.get("to");
  const hasFrom = fromParam !== null && fromParam !== "";
  const hasTo = toParam !== null && toParam !== "";

  if (hasFrom !== hasTo) {
    return NextResponse.json(
      { error: "from and to must both be provided or both omitted" },
      { status: 400 },
    );
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let rangeStart: Date;
  let rangeEnd: Date;

  if (!hasFrom && !hasTo) {
    rangeStart = new Date(today);
    rangeEnd = new Date(today);
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + DEFAULT_HORIZON_DAYS);
  } else {
    const parsedFrom = parseYmdUtc(fromParam);
    const parsedTo = parseYmdUtc(toParam);
    if (!parsedFrom || !parsedTo) {
      return NextResponse.json(
        { error: "from and to must be valid YYYY-MM-DD dates" },
        { status: 400 },
      );
    }
    if (parsedFrom.getTime() > parsedTo.getTime()) {
      return NextResponse.json(
        { error: "from must be on or before to" },
        { status: 400 },
      );
    }
    const span = inclusiveDaySpan(parsedFrom, parsedTo);
    if (span > MAX_RANGE_INCLUSIVE_DAYS) {
      return NextResponse.json(
        {
          error: `Date range too large (max ${MAX_RANGE_INCLUSIVE_DAYS} inclusive days)`,
        },
        { status: 400 },
      );
    }
    rangeStart = parsedFrom;
    rangeEnd = parsedTo;
  }

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
        date: { gte: rangeStart, lte: rangeEnd },
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
        date: { gte: rangeStart, lte: rangeEnd },
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
