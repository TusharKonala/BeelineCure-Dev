import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { AppointmentStatus, UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

type TabKey = "upcoming" | "completed" | "cancelled";

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
  const statuses =
    tab === "completed"
      ? [AppointmentStatus.COMPLETED]
      : tab === "cancelled"
        ? [AppointmentStatus.CANCELLED]
        : [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED];

  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId: doctor.id,
      status: { in: statuses },
    },
    orderBy: [{ date: "desc" }, { time: "desc" }],
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
  });
}
