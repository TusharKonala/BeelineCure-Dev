import { EmailTemplate } from "@/components/email-template";
import { prisma } from "@/lib/db";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { Resend } from "resend";
import { z } from "zod";
import { AppointmentStatus, NotificationType } from "@/generated/prisma/client";
import { inngest } from "@/inngest/client";
import {
  coerceAllowedSlotDurationMinutes,
  resolveSlotDurationForStart,
} from "@/lib/doctor-availability-slots";
import { reminderAtMsFromPatientLocal } from "@/lib/reminder-time";
import { countUpcomingAppointmentsForEmail } from "@/lib/upcoming-appointments";
import {
  formatDateInDoctorTz,
  formatDateInPatientTz,
  formatTimeInDoctorTz,
  formatTimeInPatientTz,
} from "@/lib/timezone-display";
import {
  createAppointmentNotificationForEmail,
  createDoctorNotificationForDoctorId,
} from "@/lib/notifications";
import { formatDoctorDisplayName } from "@/lib/doctor-name";
import { publicDoctorByIdWhere } from "@/lib/doctor-visibility";

const resend = new Resend(process.env.RESEND_API_KEY);

const appointmentSchema = z.object({
  doctorId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().min(1),
  patientName: z.string().min(1),
  email: z.string().email(),
  phone: z
    .string()
    .min(7, "Phone number is too short")
    .max(15, "Phone number is too long")
    .regex(/^[+0-9()\-\s]+$/, "Invalid phone number"),
  notes: z.string().optional(),
  /** In-clinic only; online bookings use Stripe + webhook. */
  consultationType: z.literal("CLINIC").default("CLINIC"),
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

  const parsed = appointmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const {
    doctorId,
    date: dateParam,
    time,
    patientName,
    email,
    phone,
    notes,
    consultationType,
    patientTimezone,
  } = parsed.data;

  const date = parseDateOnly(dateParam);
  if (!date) {
    return NextResponse.json(
      { error: "Invalid date. Use YYYY-MM-DD." },
      { status: 400 },
    );
  }

  const doctor = await prisma.doctor.findFirst({
    where: publicDoctorByIdWhere(doctorId),
    select: { id: true, name: true, timezone: true, slotDurationMinutes: true },
  });

  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  const doctorTimezone = doctor.timezone;
  const availabilityRows = await prisma.doctorAvailability.findMany({
    where: { doctorId, date },
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
      date,
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

  const existing = await prisma.appointment.findFirst({
    where: {
      doctorId,
      date,
      time,
      status: {
        not: AppointmentStatus.CANCELLED,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "This time slot is no longer available" },
      { status: 409 },
    );
  }

  const cancelToken = randomBytes(32).toString("hex");
  const rescheduleToken = randomBytes(32).toString("hex");

  let appointment;
  try {
    appointment = await prisma.appointment.create({
      data: {
        doctorId,
        date,
        time,
        patientName,
        email,
        phone,
        notes,
        consultationType,
        durationMinutes: slotDurationMinutes,
        timezone: doctorTimezone,
        patientTimezone,
        status: AppointmentStatus.CONFIRMED,
        cancelToken,
        rescheduleToken,
      },
    });
  } catch (err) {
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "This time slot is no longer available" },
        { status: 409 },
      );
    }
    throw err;
  }

  const headersList = await headers();
  const origin =
    headersList.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "http://localhost:3000";

  const cancelUrl = `${origin}/cancel?appointmentId=${encodeURIComponent(
    appointment.id,
  )}&token=${encodeURIComponent(cancelToken)}`;
  const rescheduleUrl = `${origin}/reschedule?appointmentId=${encodeURIComponent(
    appointment.id,
  )}&token=${encodeURIComponent(rescheduleToken)}`;

  try {
    const { error } = await resend.emails.send({
      from: "Clinic Appointments <onboarding@resend.dev>",
      to: email,
      subject: "Appointment Confirmation",
      react: EmailTemplate({
        doctorName: doctor.name,
        appointmentDate: formatDateInPatientTz(dateParam, time, doctorTimezone, patientTimezone),
        appointmentTime: formatTimeInPatientTz(dateParam, time, doctorTimezone, patientTimezone),
        patientName,
        consultationType,
        cancelUrl,
        rescheduleUrl,
      }),
    });
    if (error) {
      console.error("[appointments] Confirmation email failed:", error);
    }
  } catch (err) {
    console.error("[appointments] Confirmation email failed:", err);
  }

  try {
    const formattedDate = formatDateInPatientTz(
      dateParam,
      time,
      doctorTimezone,
      patientTimezone,
    );
    const formattedTime = formatTimeInPatientTz(
      dateParam,
      time,
      doctorTimezone,
      patientTimezone,
    );
    await createAppointmentNotificationForEmail({
      patientEmail: email,
      type: NotificationType.APPOINTMENT_BOOKED,
      title: "Appointment booked",
      message: `Your appointment with ${formatDoctorDisplayName(doctor.name)} is confirmed for ${formattedDate} at ${formattedTime}.`,
    });
  } catch (err) {
    console.error("[appointments] Failed to create patient notification:", err);
  }

  try {
    const doctorDateLabel = formatDateInDoctorTz(dateParam, time, doctorTimezone);
    const doctorTimeLabel = formatTimeInDoctorTz(dateParam, time, doctorTimezone);
    const modality = "in-clinic";
    await createDoctorNotificationForDoctorId({
      doctorId,
      type: NotificationType.APPOINTMENT_BOOKED,
      title: "New appointment booked",
      message: `${patientName} booked a ${modality} appointment for ${doctorDateLabel} at ${doctorTimeLabel}.`,
    });
  } catch (err) {
    console.error("[appointments] Failed to create doctor notification:", err);
  }

  try {
    const reminderAtMs = reminderAtMsFromPatientLocal(
      dateParam,
      time,
      doctorTimezone,
    );

    if (reminderAtMs !== null) {
      await inngest.send({
        name: "appointment/reminder.scheduled",
        data: {
          appointmentId: appointment.id,
        },
        ts: reminderAtMs,
      });
    }
  } catch (err) {
    console.error("[appointments] Failed to schedule reminder:", err);
  }

  return NextResponse.json(appointment);
}
