import { prisma } from "@/lib/db";
import {
  AppointmentStatus,
  ConsultationType,
  NotificationType,
  PaymentStatus,
} from "@/generated/prisma/client";
import { EmailTemplate } from "@/components/email-template";
import { inngest } from "@/inngest/client";
import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { Resend } from "resend";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
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
import { initiateRefund, refundEmailSentence } from "@/lib/refunds";

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

  // Refund logic: online + paid appointments get a full refund if cancelled
  // 24+ hours before start, a 50% refund otherwise. Clinic appointments and
  // unpaid appointments are never refunded.
  let refundSentence: string | null = null;
  let refundFailed = false;
  if (
    appointment.consultationType === ConsultationType.ONLINE &&
    appointment.paymentStatus === PaymentStatus.PAID
  ) {
    const hoursUntilStart =
      (appointmentStartMs - Date.now()) / (60 * 60 * 1000);
    const percentage: 100 | 50 = hoursUntilStart >= 24 ? 100 : 50;
    const result = await initiateRefund({
      appointment: {
        id: appointment.id,
        consultationType: appointment.consultationType,
        paymentStatus: appointment.paymentStatus,
        stripePaymentId: appointment.stripePaymentId,
        stripePaymentIntentId: appointment.stripePaymentIntentId,
        refundStatus: appointment.refundStatus,
      },
      percentage,
    });
    if (result.ok) {
      refundSentence = refundEmailSentence(result);
    } else if (result.reason === "stripe_error") {
      refundFailed = true;
    }
  }

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

    const isOnline =
      appointment.consultationType === ConsultationType.ONLINE;
    const isPaid = appointment.paymentStatus === PaymentStatus.PAID;
    // Build the cancellation message body. Online+paid cancellations append a
    // refund sentence (full or 50%) or a "no refund applies" sentence per the
    // cancellation policy when within 24 hours and no refund was initiated.
    const baseMessage = React.createElement(
      React.Fragment,
      null,
      "Your appointment has been cancelled. If you would like to book again, please visit ",
      React.createElement("a", { href: websiteUrl }, "our website"),
      ".",
    );
    let refundNode: React.ReactNode = null;
    if (isOnline && isPaid) {
      if (refundSentence) {
        refundNode = React.createElement(
          "span",
          { style: { display: "block", marginTop: "0.75rem" } },
          refundSentence,
        );
      } else if (refundFailed) {
        refundNode = React.createElement(
          "span",
          { style: { display: "block", marginTop: "0.75rem" } },
          "We attempted to initiate your refund but ran into an issue. Our support team will follow up shortly to resolve it.",
        );
      }
    }
    const messageNode = refundNode
      ? React.createElement(React.Fragment, null, baseMessage, refundNode)
      : baseMessage;

    const { error } = await resend.emails.send({
      from: "Clinic Appointments <onboarding@resend.dev>",
      to: appointment.email,
      subject: "Appointment Cancelled",
      react: EmailTemplate({
        heading: "Appointment Cancelled",
        message: messageNode,
        showActionLinks: false,
        doctorName: doctor?.name ?? "Your Doctor",
        appointmentDate: formatDateInPatientTz(
          appointmentDate,
          appointment.time,
          appointment.timezone,
          appointment.patientTimezone,
        ),
        appointmentTime: formatTimeInPatientTz(
          appointmentDate,
          appointment.time,
          appointment.timezone,
          appointment.patientTimezone,
        ),
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

  try {
    const appointmentDate = appointment.date.toISOString().slice(0, 10);
    const doctor = await prisma.doctor.findUnique({
      where: { id: appointment.doctorId },
      select: { name: true },
    });
    const doctorDisplayName = doctor?.name
      ? formatDoctorDisplayName(doctor.name)
      : null;
    const formattedDate = formatDateInPatientTz(
      appointmentDate,
      appointment.time,
      appointment.timezone,
      appointment.patientTimezone,
    );
    const formattedTime = formatTimeInPatientTz(
      appointmentDate,
      appointment.time,
      appointment.timezone,
      appointment.patientTimezone,
    );
    await createAppointmentNotificationForEmail({
      patientEmail: appointment.email,
      type: NotificationType.APPOINTMENT_CANCELLED,
      title: "Appointment cancelled",
      message: `Your appointment${
        doctorDisplayName ? ` with ${doctorDisplayName}` : ""
      } on ${formattedDate} at ${formattedTime} was cancelled.`,
    });
  } catch (err) {
    console.error("[cancel] Failed to create patient notification:", err);
  }

  try {
    const appointmentDate = appointment.date.toISOString().slice(0, 10);
    const doctorDateLabel = formatDateInDoctorTz(
      appointmentDate,
      appointment.time,
      appointment.timezone,
    );
    const doctorTimeLabel = formatTimeInDoctorTz(
      appointmentDate,
      appointment.time,
      appointment.timezone,
    );
    await createDoctorNotificationForDoctorId({
      doctorId: appointment.doctorId,
      type: NotificationType.APPOINTMENT_CANCELLED,
      title: "Appointment cancelled by patient",
      message: `${appointment.patientName} cancelled their appointment scheduled for ${doctorDateLabel} at ${doctorTimeLabel}.`,
    });
  } catch (err) {
    console.error("[cancel] Failed to create doctor notification:", err);
  }

  return NextResponse.json({ status: "success" as const });
}

