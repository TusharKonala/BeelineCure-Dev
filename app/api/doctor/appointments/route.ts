import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { AppointmentStatus, type Prisma, UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDoctorTimeInPast } from "@/lib/timezone-display";

type TabKey = "upcoming" | "pending-review" | "completed" | "cancelled";
type DateFilterValue = "asc" | "desc" | "today" | "week" | "month";

function normalizeTab(raw: string | null): TabKey {
  if (raw === "pending-review") return "pending-review";
  if (raw === "completed") return "completed";
  if (raw === "cancelled") return "cancelled";
  return "upcoming";
}

function normalizeDateFilter(raw: string | null): DateFilterValue {
  if (raw === "asc") return "asc";
  if (raw === "today") return "today";
  if (raw === "week") return "week";
  if (raw === "month") return "month";
  return "desc";
}

function ymdToDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function ymdFromDateUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysToYmd(ymd: string, days: number): string {
  const base = ymdToDate(ymd);
  base.setUTCDate(base.getUTCDate() + days);
  return ymdFromDateUtc(base);
}

function ymdInTimezone(timezone: string, baseDate = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(baseDate);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) return ymdFromDateUtc(baseDate);
  return `${year}-${month}-${day}`;
}

function thisWeekBoundsInTimezone(timezone: string): { start: string; end: string } {
  const today = ymdInTimezone(timezone);
  const day = ymdToDate(today).getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = addDaysToYmd(today, mondayOffset);
  return { start, end: addDaysToYmd(start, 6) };
}

function thisMonthBoundsInTimezone(timezone: string): { start: string; end: string } {
  const today = ymdInTimezone(timezone);
  const [y, m] = today.split("-").map((part) => Number(part));
  if (!Number.isFinite(y) || !Number.isFinite(m)) {
    return { start: today, end: today };
  }

  const year = String(y).padStart(4, "0");
  const month = String(m).padStart(2, "0");
  const start = `${year}-${month}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

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
    select: { id: true, timezone: true },
  });
  if (!doctor) {
    return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });
  }

  const tab = normalizeTab(request.nextUrl.searchParams.get("tab"));
  const search = (request.nextUrl.searchParams.get("search") ?? "").trim();
  const dateFilter = normalizeDateFilter(request.nextUrl.searchParams.get("dateFilter"));
  const statuses =
    tab === "completed"
      ? [AppointmentStatus.COMPLETED]
      : tab === "cancelled"
        ? [AppointmentStatus.CANCELLED]
        : [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED];

  const baseWhere: Prisma.AppointmentWhereInput = {
    doctorId: doctor.id,
    status: { in: statuses },
  };

  if (dateFilter === "today") {
    const today = ymdInTimezone(doctor.timezone);
    baseWhere.date = { gte: ymdToDate(today), lte: ymdToDate(today) };
  } else if (dateFilter === "week") {
    const { start, end } = thisWeekBoundsInTimezone(doctor.timezone);
    baseWhere.date = { gte: ymdToDate(start), lte: ymdToDate(end) };
  } else if (dateFilter === "month") {
    const { start, end } = thisMonthBoundsInTimezone(doctor.timezone);
    baseWhere.date = { gte: ymdToDate(start), lte: ymdToDate(end) };
  }

  const selectedWhere: Prisma.AppointmentWhereInput = search
    ? {
        ...baseWhere,
        OR: [
          { patientName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      }
    : baseWhere;
  const sortDesc = dateFilter !== "asc";

  const appointments = await prisma.appointment.findMany({
    where: selectedWhere,
    orderBy: [{ date: sortDesc ? "desc" : "asc" }, { time: sortDesc ? "desc" : "asc" }],
    select: {
      id: true,
      patientName: true,
      email: true,
      phone: true,
      date: true,
      time: true,
      timezone: true,
      consultationType: true,
      status: true,
      notes: true,
    },
  });

  const filteredAppointments =
    tab === "pending-review"
      ? appointments.filter(
          (a) =>
            a.status === AppointmentStatus.CONFIRMED &&
            isDoctorTimeInPast(a.date.toISOString().slice(0, 10), a.time, a.timezone),
        )
      : tab === "upcoming"
        ? appointments.filter((a) => {
            if (a.status === AppointmentStatus.PENDING) return true;
            if (a.status !== AppointmentStatus.CONFIRMED) return false;
            return !isDoctorTimeInPast(a.date.toISOString().slice(0, 10), a.time, a.timezone);
          })
        : appointments;

  return NextResponse.json({
    items: filteredAppointments.map((a) => ({
      id: a.id,
      patientName: a.patientName,
      email: a.email,
      phone: a.phone,
      date: a.date.toISOString().slice(0, 10),
      time: a.time,
      timezone: a.timezone,
      consultationType: a.consultationType,
      status: a.status,
      notes: a.notes,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.DOCTOR) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!doctor) {
    return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { appointmentId?: string } | null;
  const appointmentId = body?.appointmentId?.trim();
  if (!appointmentId) {
    return NextResponse.json({ error: "appointmentId is required" }, { status: 400 });
  }

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      doctorId: doctor.id,
    },
    select: {
      id: true,
      status: true,
    },
  });
  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }
  if (appointment.status === AppointmentStatus.CANCELLED) {
    return NextResponse.json({ error: "Appointment already cancelled" }, { status: 409 });
  }
  if (appointment.status === AppointmentStatus.COMPLETED) {
    return NextResponse.json(
      { error: "Completed appointments cannot be cancelled" },
      { status: 409 },
    );
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: AppointmentStatus.CANCELLED },
  });

  return NextResponse.json({ ok: true });
}
