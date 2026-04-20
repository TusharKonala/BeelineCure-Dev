import { prisma } from "@/lib/db";
import { publicDoctorByIdWhere } from "@/lib/doctor-visibility";
import { AppointmentStatus } from "@/generated/prisma/client";
import {
  coerceAllowedSlotDurationMinutes,
  resolveSlotDurationForStart,
} from "@/lib/doctor-availability-slots";
import { countUpcomingAppointmentsForEmail } from "@/lib/upcoming-appointments";
import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bookingSessionSchema = z.object({
  doctorId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().min(1),
  consultationType: z.enum(["CLINIC", "ONLINE"]),
  patientName: z.string().min(1),
  email: z.string().email(),
  phone: z
    .string()
    .min(7, "Phone number is too short")
    .max(15, "Phone number is too long")
    .regex(/^[+0-9()\-\s]+$/, "Invalid phone number"),
  notes: z.string().optional(),
  timezone: z.string().min(1).max(128).default("UTC"),
  patientTimezone: z.string().min(1).max(128).default("UTC"),
});

function parseDateOnly(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bookingSessionSchema.safeParse(body);

  if (!parsed.success) {
    console.log(parsed.error.flatten());
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const {
    doctorId,
    date,
    time,
    consultationType,
    patientName,
    email,
    phone,
    notes,
    patientTimezone,
  } = parsed.data;

  const appointmentDate = parseDateOnly(date);
  if (!appointmentDate) {
    return NextResponse.json({ error: "Invalid date. Use YYYY-MM-DD." }, { status: 400 });
  }

  const doctor = await prisma.doctor.findFirst({
    where: publicDoctorByIdWhere(doctorId),
    select: { id: true, timezone: true, slotDurationMinutes: true },
  });

  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  const doctorTimezone = doctor.timezone;
  const availabilityRows = await prisma.doctorAvailability.findMany({
    where: { doctorId, date: appointmentDate },
  });
  const fallbackDuration = coerceAllowedSlotDurationMinutes(
    doctor.slotDurationMinutes,
  );
  const slotDurationMinutes = resolveSlotDurationForStart(
    availabilityRows,
    time,
    fallbackDuration,
  );
  if (slotDurationMinutes === null) {
    return NextResponse.json(
      { error: "This time slot is no longer available" },
      { status: 409 },
    );
  }

  const existingSameDate = await prisma.appointment.findFirst({
    where: {
      email,
      doctorId,
      date: appointmentDate,
      status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
    },
    select: {
      id: true,
      rescheduleToken: true,
    },
  });

  if (existingSameDate) {
    let rescheduleToken = existingSameDate.rescheduleToken;
    if (!rescheduleToken) {
      rescheduleToken = randomBytes(32).toString("hex");
      await prisma.appointment.update({
        where: { id: existingSameDate.id },
        data: { rescheduleToken },
      });
    }

    return NextResponse.json(
      {
        error:
          "You already have an appointment on this date. Would you like to reschedule it instead?",
        code: "EXISTING_APPOINTMENT_SAME_DATE",
        link: {
          href: `/reschedule?appointmentId=${encodeURIComponent(
            existingSameDate.id,
          )}&token=${encodeURIComponent(rescheduleToken)}`,
          label: "reschedule it",
        },
      },
      { status: 409 },
    );
  }

  const upcomingCount = await countUpcomingAppointmentsForEmail(email);

  if (upcomingCount >= 2) {
    return NextResponse.json(
      {
        error:
          "You've reached the limit of 2 upcoming appointments. Please complete or cancel an existing appointment before booking a new one.",
        code: "UPCOMING_APPOINTMENT_LIMIT_REACHED",
        link: {
          href: "/patient/appointments",
          label: "cancel an existing appointment",
        },
      },
      { status: 409 },
    );
  }

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const bookingSession = await prisma.bookingSession.create({
    data: {
      doctorId,
      patientName,
      email,
      phone,
      date,
      time,
      durationMinutes: slotDurationMinutes,
      timezone: doctorTimezone,
      patientTimezone,
      notes: notes,
      consultationType,
      status: "PENDING",
      expiresAt,
    },
  });

  return NextResponse.json({ bookingSessionId: bookingSession.id });
}
