import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { AppointmentStatus, UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reschedulePatientAppointment } from "@/lib/appointment-reschedule";
import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";
import { headers } from "next/headers";

const bodySchema = z.object({
  appointmentId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});

function parseDateOnly(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { appointmentId, date: dateParam, time } = parsed.data;
  const date = parseDateOnly(dateParam);
  if (!date) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  if (appointment.status === AppointmentStatus.CANCELLED) {
    return NextResponse.json(
      { error: "Appointment is cancelled" },
      { status: 409 },
    );
  }

  if (appointment.status === AppointmentStatus.COMPLETED) {
    return NextResponse.json(
      { error: "Appointment is completed" },
      { status: 409 },
    );
  }

  const appointmentDateParam = appointment.date.toISOString().slice(0, 10);
  const timeWithSeconds =
    appointment.time.length === 5 ? `${appointment.time}:00` : appointment.time;
  const appointmentStartMs = fromZonedTime(
    `${appointmentDateParam}T${timeWithSeconds}`,
    appointment.timezone,
  ).getTime();
  if (appointmentStartMs <= Date.now()) {
    return NextResponse.json(
      { error: "Cannot reschedule a past appointment" },
      { status: 409 },
    );
  }

  if (!appointment.cancelToken || !appointment.rescheduleToken) {
    return NextResponse.json(
      { error: "Appointment is missing cancel/reschedule tokens" },
      { status: 409 },
    );
  }

  const headersList = await headers();
  const requestOrigin =
    headersList.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    request.nextUrl.origin;

  const result = await reschedulePatientAppointment({
    appointment: {
      id: appointment.id,
      doctorId: appointment.doctorId,
      email: appointment.email,
      patientName: appointment.patientName,
      consultationType: appointment.consultationType,
      timezone: appointment.timezone,
      patientTimezone: appointment.patientTimezone,
      cancelToken: appointment.cancelToken,
      rescheduleToken: appointment.rescheduleToken,
    },
    dateParam,
    date,
    time,
    requestOrigin,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "That time slot is no longer available" },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
