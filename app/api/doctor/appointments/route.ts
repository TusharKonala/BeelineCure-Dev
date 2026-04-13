import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { AppointmentStatus, UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

type TabKey = "upcoming" | "completed" | "cancelled";
type DateFilterValue = "asc" | "desc";

function normalizeTab(raw: string | null): TabKey {
  if (raw === "completed") return "completed";
  if (raw === "cancelled") return "cancelled";
  return "upcoming";
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
    select: { id: true },
  });
  if (!doctor) {
    return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });
  }

  const tab = normalizeTab(request.nextUrl.searchParams.get("tab"));
  const patientName = (request.nextUrl.searchParams.get("patientName") ?? "").trim();
  const dateFilter = request.nextUrl.searchParams.get("dateFilter") === "asc" ? "asc" : "desc";
  const statuses =
    tab === "completed"
      ? [AppointmentStatus.COMPLETED]
      : tab === "cancelled"
        ? [AppointmentStatus.CANCELLED]
        : [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED];

  const baseWhere = {
    doctorId: doctor.id,
    status: { in: statuses },
  } as const;

  const selectedWhere = patientName ? { ...baseWhere, patientName } : baseWhere;
  const sortDesc = (dateFilter as DateFilterValue) !== "asc";

  const [appointments, optionSourceAppointments] = await Promise.all([
    prisma.appointment.findMany({
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
    }),
    prisma.appointment.findMany({
      where: baseWhere,
      select: {
        patientName: true,
      },
    }),
  ]);

  const patientOptions = Array.from(
    new Set(optionSourceAppointments.map((appointment) => appointment.patientName)),
  ).sort((a, b) => a.localeCompare(b));

  return NextResponse.json({
    items: appointments.map((a) => ({
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
    patientOptions,
  });
}
