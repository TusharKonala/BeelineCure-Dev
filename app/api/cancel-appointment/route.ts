import { prisma } from "@/lib/db";
import { AppointmentStatus } from "@/generated/prisma/client";
import { EmailTemplate } from "@/components/email-template";
import { inngest } from "@/inngest/client";
import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { Resend } from "resend";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";

const resend = new Resend(process.env.RESEND_API_KEY);

const cancelSchema = z.object({
  appointmentId: z.string().min(1),
  token: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const appointmentId = request.nextUrl.searchParams.get("appointmentId") ?? "";
  const token = request.nextUrl.searchParams.get("token") ?? "";

  const parsed = cancelSchema.safeParse({ appointmentId, token });
  if (!parsed.success) {
    return NextResponse.json({ status: "invalid_link" as const });
  }

  const { appointmentId: validatedAppointmentId, token: validatedToken } =
    parsed.data;

  const appointment = await prisma.appointment.findUnique({
    where: { id: validatedAppointmentId },
  });

  if (
    !appointment ||
    !appointment.cancelToken ||
    appointment.cancelToken !== validatedToken
  ) {
    return NextResponse.json({ status: "invalid_link" as const });
  }

  // Disallow cancelling past or completed appointments.
  if (appointment.status === AppointmentStatus.CANCELLED) {
    return NextResponse.json({ status: "already_cancelled" as const });
  }
  if (appointment.status === AppointmentStatus.COMPLETED) {
    return NextResponse.json({ status: "invalid_link" as const });
  }

  const appointmentDateParam = appointment.date.toISOString().slice(0, 10);
  const timeWithSeconds = appointment.time.length === 5 ? `${appointment.time}:00` : appointment.time;
  const appointmentStartMs = fromZonedTime(
    `${appointmentDateParam}T${timeWithSeconds}`,
    appointment.timezone,
  ).getTime();
  if (appointmentStartMs <= Date.now()) {
    return NextResponse.json({ status: "invalid_link" as const });
  }

  return NextResponse.json({ status: "valid" as const });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "invalid_link" as const });
  }

  const { appointmentId, token } = parsed.data;

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment || !appointment.cancelToken || appointment.cancelToken !== token) {
    return NextResponse.json({ status: "invalid_link" as const });
  }

  // Disallow cancelling past or completed appointments.
  if (appointment.status === AppointmentStatus.CANCELLED) {
    return NextResponse.json({ status: "already_cancelled" as const });
  }
  if (appointment.status === AppointmentStatus.COMPLETED) {
    return NextResponse.json({ status: "invalid_link" as const });
  }

  const appointmentDateParam = appointment.date.toISOString().slice(0, 10);
  const timeWithSeconds = appointment.time.length === 5 ? `${appointment.time}:00` : appointment.time;
  const appointmentStartMs = fromZonedTime(
    `${appointmentDateParam}T${timeWithSeconds}`,
    appointment.timezone,
  ).getTime();
  if (appointmentStartMs <= Date.now()) {
    return NextResponse.json({ status: "invalid_link" as const });
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: AppointmentStatus.CANCELLED },
  });

  try {
    await inngest.send({
      name: "appointment/reminder.cancelled",
      data: {
        appointmentId,
      },
    });
  } catch (err) {
    console.error("[cancel] Failed to cancel reminder:", err);
  }

  // Best-effort cancellation email; cancellation still succeeds if email fails.
  try {
    const appointmentDate = appointment.date.toISOString().slice(0, 10);
    const websiteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const doctor = await prisma.doctor.findUnique({
      where: { id: appointment.doctorId },
    });

    const { error } = await resend.emails.send({
      from: "Clinic Appointments <onboarding@resend.dev>",
      to: appointment.email,
      subject: "Appointment Cancelled",
      react: EmailTemplate({
        heading: "Appointment Cancelled",
        message: React.createElement(
          React.Fragment,
          null,
          "Your appointment has been cancelled. If you would like to book again, please visit ",
          React.createElement("a", { href: websiteUrl }, "our website"),
          ".",
        ),
        showActionLinks: false,
        doctorName: doctor?.name ?? "Your Doctor",
        appointmentDate,
        appointmentTime: appointment.time,
        patientName: appointment.patientName,
        consultationType: appointment.consultationType,
        cancelUrl: "",
        rescheduleUrl: "",
      }),
    });

    if (error) {
      console.error("[cancel] Cancellation email failed:", error);
    }
  } catch (err) {
    console.error("[cancel] Cancellation email failed:", err);
  }

  return NextResponse.json({ status: "success" as const });
}

