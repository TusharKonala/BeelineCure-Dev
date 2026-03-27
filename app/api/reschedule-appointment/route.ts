import { prisma } from "@/lib/db";
import { AppointmentStatus } from "@/generated/prisma/client";
import { EmailTemplate } from "@/components/email-template";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { headers } from "next/headers";
import { Resend } from "resend";
import { inngest } from "@/inngest/client";

const resend = new Resend(process.env.RESEND_API_KEY);

const rescheduleTokenSchema = z.object({
  appointmentId: z.string().min(1),
  token: z.string().min(1),
});

const rescheduleSchema = z.object({
  appointmentId: z.string().min(1),
  token: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});

function parseDateOnly(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

type RescheduleResponse =
  | { status: "success"; appointment?: unknown }
  | { status: "invalid_link" }
  | { status: "invalid_body" }
  | { status: "already_cancelled" }
  | { status: "slot_unavailable" };

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const appointmentId = request.nextUrl.searchParams.get("appointmentId") ?? "";
  const token = request.nextUrl.searchParams.get("token") ?? "";

  const parsed = rescheduleTokenSchema.safeParse({ appointmentId, token });
  if (!parsed.success) {
    return NextResponse.json({
      status: "invalid_link",
    } satisfies RescheduleResponse);
  }

  const { appointmentId: validatedAppointmentId, token: validatedToken } =
    parsed.data;

  const appointment = await prisma.appointment.findUnique({
    where: { id: validatedAppointmentId },
  });

  if (
    !appointment ||
    !appointment.rescheduleToken ||
    appointment.rescheduleToken !== validatedToken
  ) {
    return NextResponse.json({
      status: "invalid_link",
    } satisfies RescheduleResponse);
  }

  if (appointment.status === AppointmentStatus.CANCELLED) {
    return NextResponse.json({
      status: "already_cancelled",
    } satisfies RescheduleResponse);
  }

  return NextResponse.json({
    status: "success",
    appointment: {
      id: appointment.id,
      doctorId: appointment.doctorId,
      date: formatDateOnly(appointment.date),
      time: appointment.time,
      consultationType: appointment.consultationType,
      status: appointment.status,
    },
  } satisfies RescheduleResponse);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({
      status: "invalid_body",
    } satisfies RescheduleResponse);
  }

  const parsed = rescheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      status: "invalid_body",
    } satisfies RescheduleResponse);
  }

  const { appointmentId, token, date: dateParam, time } = parsed.data;
  const date = parseDateOnly(dateParam);
  if (!date) {
    return NextResponse.json({
      status: "invalid_body",
    } satisfies RescheduleResponse);
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (
    !appointment ||
    !appointment.rescheduleToken ||
    appointment.rescheduleToken !== token
  ) {
    return NextResponse.json({
      status: "invalid_link",
    } satisfies RescheduleResponse);
  }

  if (appointment.status === AppointmentStatus.CANCELLED) {
    return NextResponse.json({
      status: "already_cancelled",
    } satisfies RescheduleResponse);
  }

  const conflict = await prisma.appointment.findFirst({
    where: {
      doctorId: appointment.doctorId,
      date,
      time,
      status: { not: AppointmentStatus.CANCELLED },
      id: { not: appointmentId },
    },
  });

  if (conflict) {
    return NextResponse.json({
      status: "slot_unavailable",
    } satisfies RescheduleResponse);
  }

  const updatedAppointment = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      date,
      time,
    },
  });

  try {
    await inngest.send({
      name: "appointment/reminder.cancelled",
      data: {
        appointmentId: updatedAppointment.id,
      },
    });

    const appointmentDateTime = new Date(`${dateParam}T${time}:00`);
    const reminderAtMs = appointmentDateTime.getTime() - 24 * 60 * 60 * 1000;

    await inngest.send({
      name: "appointment/reminder.scheduled",
      data: {
        appointmentId: updatedAppointment.id,
      },
      ts: reminderAtMs,
    });
  } catch (err) {
    console.error("[reschedule] Failed to re-schedule reminder:", err);
  }

  // Best-effort notification email: don't fail rescheduling if email delivery fails.
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: updatedAppointment.doctorId },
    });

    if (
      !doctor ||
      !updatedAppointment.email ||
      !updatedAppointment.cancelToken ||
      !updatedAppointment.rescheduleToken
    ) {
      console.error(
        "[reschedule] Missing doctor/email/tokens; skipping confirmation email.",
      );
    } else {
      const headersList = await headers();
      const origin =
        headersList.get("origin") ??
        process.env.NEXT_PUBLIC_APP_URL ??
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
        "http://localhost:3000";

      const cancelUrl = `${origin}/cancel?appointmentId=${encodeURIComponent(
        updatedAppointment.id,
      )}&token=${encodeURIComponent(updatedAppointment.cancelToken)}`;
      const rescheduleUrl = `${origin}/reschedule?appointmentId=${encodeURIComponent(
        updatedAppointment.id,
      )}&token=${encodeURIComponent(updatedAppointment.rescheduleToken)}`;

      const { error } = await resend.emails.send({
        from: "Clinic Appointments <onboarding@resend.dev>",
        to: updatedAppointment.email,
        subject: "Appointment Rescheduled",
        react: EmailTemplate({
          heading: "Appointment Rescheduled",
          message:
            updatedAppointment.consultationType === "ONLINE"
              ? "Your appointment has been rescheduled. Please be available at the scheduled time. To cancel or reschedule, use the links below."
              : "Your appointment has been rescheduled. Please arrive a few minutes early. To cancel or reschedule, use the links below.",
          doctorName: doctor.name,
          appointmentDate: dateParam,
          appointmentTime: time,
          patientName: updatedAppointment.patientName,
          consultationType: updatedAppointment.consultationType,
          cancelUrl,
          rescheduleUrl,
        }),
      });

      if (error) {
        console.error("[reschedule] Confirmation email failed:", error);
      }
    }
  } catch (err) {
    console.error("[reschedule] Confirmation email failed:", err);
  }

  return NextResponse.json({ status: "success" } satisfies RescheduleResponse);
}
