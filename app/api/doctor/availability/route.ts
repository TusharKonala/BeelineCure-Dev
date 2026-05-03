import {
  AppointmentStatus,
  UserRole,
} from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { cancelAppointmentByDoctor } from "@/lib/doctor-cancellations";
import { prisma } from "@/lib/db";
import {
  coerceAllowedSlotDurationMinutes,
  expandAvailabilityRows,
  expandAvailabilityRowsDetailed,
  inferSlotDurationMinutesFromRows,
  isValidSlotStartForDuration,
  slotEndFromStart,
} from "@/lib/doctor-availability-slots";
import {
  enumerateInclusiveYmd,
  getDoctorLocalTodayIso,
  ymdToPrismaDate,
} from "@/lib/doctor-local-date";
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const durationSchema = z.union([
  z.literal(15),
  z.literal(30),
  z.literal(45),
  z.literal(60),
]);

function parseYmdOrNull(s: string | null): string | null {
  if (!s?.trim()) return null;
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(t + "T12:00:00.000Z");
  if (Number.isNaN(d.getTime())) return null;
  return t;
}

const putBodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("range"),
    startDate: ymd,
    endDate: ymd,
    slotStarts: z.array(z.string()),
    newSlots: z.array(z.string()).optional(),
    removedSlots: z.array(z.string()).optional(),
    slotDurationMinutes: durationSchema.optional(),
    consultationType: z.enum(["CLINIC", "ONLINE", "BOTH"]).optional(),
    /**
     * Explicitly clear the day(s) — delete all availability rows and cancel any
     * active appointments. Required to wipe a day; an empty `slotStarts` array
     * without this flag is rejected so accidental empty saves never destroy
     * data.
     */
    clearDay: z.boolean().optional().default(false),
  }),
  z.object({
    mode: z.literal("single"),
    singleDate: ymd,
    slotStarts: z.array(z.string()),
    newSlots: z.array(z.string()).optional(),
    removedSlots: z.array(z.string()).optional(),
    slotDurationMinutes: durationSchema.optional(),
    consultationType: z.enum(["CLINIC", "ONLINE", "BOTH"]).optional(),
    clearDay: z.boolean().optional().default(false),
  }),
]);

const patchBodySchema = z.object({
  slotDurationMinutes: durationSchema,
});

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.DOCTOR) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    select: { id: true, timezone: true, slotDurationMinutes: true },
  });
  if (!doctor) {
    return NextResponse.json(
      { error: "Doctor profile not found" },
      { status: 404 },
    );
  }

  const tz = doctor.timezone;
  const today = getDoctorLocalTodayIso(tz);
  const fallbackDuration = coerceAllowedSlotDurationMinutes(
    doctor.slotDurationMinutes,
  );

  const view = request.nextUrl.searchParams.get("view");
  if (view === "list") {
    const page = Math.max(
      1,
      Number(request.nextUrl.searchParams.get("page") ?? "1") || 1,
    );
    const limit = Math.min(
      20,
      Math.max(
        1,
        Number(request.nextUrl.searchParams.get("limit") ?? "10") || 10,
      ),
    );
    const rows = await prisma.doctorAvailability.findMany({
      where: {
        doctorId: doctor.id,
        date: { gte: ymdToPrismaDate(today) },
      },
      select: {
        date: true,
        startTime: true,
        endTime: true,
        slotDurationMinutes: true,
        consultationType: true,
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    const byDate = new Map<
      string,
      {
        startTime: string;
        endTime: string;
        slotDurationMinutes: number;
        consultationType: "CLINIC" | "ONLINE" | "BOTH";
      }[]
    >();
    for (const r of rows) {
      const key = r.date.toISOString().slice(0, 10);
      const list = byDate.get(key) ?? [];
      list.push({
        startTime: r.startTime,
        endTime: r.endTime,
        slotDurationMinutes: r.slotDurationMinutes,
        consultationType: r.consultationType,
      });
      byDate.set(key, list);
    }

    const days: { date: string; slotStarts: string[] }[] = [];
    for (const [dateStr, windows] of byDate) {
      const slotStarts = expandAvailabilityRows(windows, fallbackDuration);
      if (slotStarts.length === 0) continue;
      days.push({ date: dateStr, slotStarts });
    }
    days.sort((a, b) => a.date.localeCompare(b.date));
    const start = (page - 1) * limit;
    const paginatedDays = days.slice(start, start + limit);

    return NextResponse.json({
      timezone: tz,
      today,
      slotDurationMinutes: fallbackDuration,
      days: paginatedDays,
      hasMore: start + limit < days.length,
      total: days.length,
      page,
    });
  }

  const dateParam = parseYmdOrNull(request.nextUrl.searchParams.get("date"));
  if (dateParam === null && request.nextUrl.searchParams.has("date")) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  if (!dateParam) {
    return NextResponse.json({
      timezone: tz,
      today,
      slotDurationMinutes: fallbackDuration,
    });
  }

  if (dateParam < today) {
    return NextResponse.json(
      { error: "Cannot load availability for past dates" },
      { status: 400 },
    );
  }

  const rows = await prisma.doctorAvailability.findMany({
    where: { doctorId: doctor.id, date: ymdToPrismaDate(dateParam) },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      slotDurationMinutes: true,
      consultationType: true,
    },
  });
  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId: doctor.id,
      date: ymdToPrismaDate(dateParam),
      status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING] },
    },
    select: { time: true },
  });

  const slotDurationMinutes = inferSlotDurationMinutesFromRows(
    rows,
    fallbackDuration,
  );
  const slotDetails = expandAvailabilityRowsDetailed(rows, fallbackDuration);
  const slotStarts = slotDetails.map((slot) => slot.startTime);
  const consultationType = rows[0]?.consultationType ?? "BOTH";

  return NextResponse.json({
    timezone: tz,
    today,
    slotDurationMinutes,
    slotStarts,
    slotDetails,
    consultationType,
    bookedSlotStarts: appointments.map((appointment) => appointment.time).sort(),
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.DOCTOR) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let parsed: z.infer<typeof patchBodySchema>;
  try {
    const json: unknown = await request.json();
    parsed = patchBodySchema.parse(json);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    select: { id: true, isActive: true },
  });
  if (!doctor) {
    return NextResponse.json(
      { error: "Doctor profile not found" },
      { status: 404 },
    );
  }
  if (!doctor.isActive) {
    return NextResponse.json(
      {
        error:
          "Account deactivated. New availability cannot be accepted while your account is inactive.",
      },
      { status: 403 },
    );
  }

  await prisma.doctor.update({
    where: { id: doctor.id },
    data: { slotDurationMinutes: parsed.slotDurationMinutes },
  });

  return NextResponse.json({
    ok: true,
    slotDurationMinutes: parsed.slotDurationMinutes,
  });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.DOCTOR) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      timezone: true,
      slotDurationMinutes: true,
      isActive: true,
    },
  });
  if (!doctor) {
    return NextResponse.json(
      { error: "Doctor profile not found" },
      { status: 404 },
    );
  }
  if (!doctor.isActive) {
    return NextResponse.json(
      {
        error:
          "Account deactivated. New availability cannot be accepted while your account is inactive.",
      },
      { status: 403 },
    );
  }

  let parsed: z.infer<typeof putBodySchema>;
  try {
    const json: unknown = await request.json();
    parsed = putBodySchema.parse(json);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const tz = doctor.timezone;
  const today = getDoctorLocalTodayIso(tz);
  const duration =
    parsed.slotDurationMinutes ??
    coerceAllowedSlotDurationMinutes(doctor.slotDurationMinutes);
  const consultationType = parsed.consultationType ?? "BOTH";
  const clearDay = parsed.clearDay ?? false;

  const slotStarts = [...new Set(parsed.slotStarts)];
  const newSlots = [...new Set(parsed.newSlots ?? [])];
  const removedSlots = [...new Set(parsed.removedSlots ?? [])];

  if (clearDay && slotStarts.length > 0) {
    return NextResponse.json(
      {
        error:
          "clearDay cannot be used together with slotStarts. Send clearDay:true with an empty slotStarts to wipe the day.",
      },
      { status: 400 },
    );
  }

  if (!clearDay && slotStarts.length === 0) {
    return NextResponse.json(
      {
        error:
          "No slots provided. Set clearDay:true to mark the day as a holiday.",
      },
      { status: 400 },
    );
  }

  for (const s of [...slotStarts, ...newSlots, ...removedSlots]) {
    if (!isValidSlotStartForDuration(s, duration)) {
      return NextResponse.json(
        {
          error: `Each slot must align to a ${duration}-minute schedule (valid start times for this duration).`,
        },
        { status: 400 },
      );
    }
  }
  slotStarts.sort();

  let affectedYmd: string[];
  if (parsed.mode === "range") {
    if (parsed.startDate > parsed.endDate) {
      return NextResponse.json(
        { error: "startDate must be on or before endDate" },
        { status: 400 },
      );
    }
    affectedYmd = enumerateInclusiveYmd(parsed.startDate, parsed.endDate);
  } else {
    affectedYmd = [parsed.singleDate];
  }

  if (affectedYmd.length === 0) {
    return NextResponse.json({ error: "No dates in range" }, { status: 400 });
  }

  for (const d of affectedYmd) {
    if (d < today) {
      return NextResponse.json(
        { error: "Cannot set availability for past dates" },
        { status: 400 },
      );
    }
  }

  const affectedDates = affectedYmd.map((date) => ymdToPrismaDate(date));
  const activeAppointments = await prisma.appointment.findMany({
    where: {
      doctorId: doctor.id,
      date: { in: affectedDates },
      status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING] },
    },
    select: { id: true, date: true, time: true },
  });
  const appointmentsByDate = new Map<string, { id: string; time: string }[]>();
  for (const appointment of activeAppointments) {
    const dateKey = appointment.date.toISOString().slice(0, 10);
    const current = appointmentsByDate.get(dateKey) ?? [];
    current.push({ id: appointment.id, time: appointment.time });
    appointmentsByDate.set(dateKey, current);
  }

  if (slotStarts.length > 0 || removedSlots.length > 0) {
    const selectedStarts = new Set(slotStarts);
    for (const ymdStr of affectedYmd) {
      const booked = appointmentsByDate.get(ymdStr) ?? [];
      const removedBookedSlots =
        parsed.mode === "single" && (newSlots.length > 0 || removedSlots.length > 0)
          ? booked
              .filter((appointment) => removedSlots.includes(appointment.time))
              .map((appointment) => appointment.time)
          : booked
              .filter((appointment) => !selectedStarts.has(appointment.time))
              .map((appointment) => appointment.time);
      if (removedBookedSlots.length > 0) {
        return NextResponse.json(
          {
            error: `Cannot remove booked slots (${removedBookedSlots.join(", ")}). Booked slots are locked.`,
          },
          { status: 409 },
        );
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.doctor.update({
      where: { id: doctor.id },
      data: { slotDurationMinutes: duration },
    });
    for (const ymdStr of affectedYmd) {
      const date = ymdToPrismaDate(ymdStr);
      if (clearDay) {
        await tx.doctorAvailability.deleteMany({
          where: { doctorId: doctor.id, date },
        });
        continue;
      }
      const existingRows = await tx.doctorAvailability.findMany({
        where: { doctorId: doctor.id, date },
        select: {
          startTime: true,
          slotDurationMinutes: true,
          consultationType: true,
        },
      });
      const merged = new Map<
        string,
        {
          startTime: string;
          slotDurationMinutes: number;
          consultationType: "CLINIC" | "ONLINE" | "BOTH";
        }
      >();
      for (const row of existingRows) {
        merged.set(row.startTime, {
          startTime: row.startTime,
          slotDurationMinutes: row.slotDurationMinutes,
          consultationType: row.consultationType,
        });
      }
      if (parsed.mode === "single" && (newSlots.length > 0 || removedSlots.length > 0)) {
        for (const startTime of removedSlots) {
          merged.delete(startTime);
        }
        for (const startTime of newSlots) {
          merged.set(startTime, {
            startTime,
            slotDurationMinutes: duration,
            consultationType,
          });
        }
      } else {
        for (const startTime of slotStarts) {
          merged.set(startTime, {
            startTime,
            slotDurationMinutes: duration,
            consultationType,
          });
        }
      }
      await tx.doctorAvailability.deleteMany({
        where: { doctorId: doctor.id, date },
      });
      await tx.doctorAvailability.createMany({
        data: [...merged.values()].map((row) => ({
          doctorId: doctor.id,
          date,
          startTime: row.startTime,
          endTime: slotEndFromStart(row.startTime, row.slotDurationMinutes),
          slotDurationMinutes: row.slotDurationMinutes,
          consultationType: row.consultationType,
        })),
      });
    }
  });

  if (clearDay && activeAppointments.length > 0) {
    const requestOrigin = new URL(request.url).origin;
    for (const appointment of activeAppointments) {
      await cancelAppointmentByDoctor({
        appointmentId: appointment.id,
        doctorId: doctor.id,
        reason: "doctor_holiday",
        requestOrigin,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    affectedDates: affectedYmd.length,
    cancelledAppointments: clearDay ? activeAppointments.length : 0,
  });
}
