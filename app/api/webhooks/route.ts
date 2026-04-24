import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";
import { headers } from "next/headers";
import {
  BookingSessionStatus,
  AppointmentStatus,
  PaymentStatus,
  ConsultationType,
  NotificationType,
  RefundStatus,
} from "@/generated/prisma/client";
import { EmailTemplate } from "@/components/email-template";
import { Resend } from "resend";
import { inngest } from "@/inngest/client";
import { reminderAtMsFromPatientLocal } from "@/lib/reminder-time";
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
import { createMeetEventForOnlineAppointment } from "@/lib/google-calendar-meet";

const resend = new Resend(process.env.RESEND_API_KEY);

function parseDateOnly(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export async function POST(request: NextRequest) {
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return new NextResponse("Webhook signature missing", { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata ?? {};

    const bookingSessionId = metadata.bookingSessionId;

    if (!bookingSessionId) {
      // Nothing to do if we cannot associate to a booking session
      return new NextResponse("OK", { status: 200 });
    }

    const bookingSession = await prisma.bookingSession.findUnique({
      where: { id: bookingSessionId },
    });

    if (!bookingSession) {
      // Ignore if the booking session no longer exists
      return new NextResponse("OK", { status: 200 });
    }

    if (bookingSession.status !== BookingSessionStatus.PENDING) {
      // Already processed or no longer valid – ignore duplicate webhooks
      return new NextResponse("OK", { status: 200 });
    }
    if (bookingSession.consultationType !== "ONLINE") {
      console.warn(
        "[webhooks] Ignoring non-online booking session:",
        bookingSession.id,
        bookingSession.consultationType,
      );
      return new NextResponse("OK", { status: 200 });
    }

    const date = parseDateOnly(bookingSession.date);

    if (!date) {
      console.error(
        "[webhooks] Invalid date on booking session",
        bookingSession.id,
        bookingSession.date,
      );
      return new NextResponse("OK", { status: 200 });
    }

    const doctor = await prisma.doctor.findFirst({
      where: publicDoctorByIdWhere(bookingSession.doctorId),
    });

    if (!doctor) {
      console.error(
        "[webhooks] Doctor not found for booking session",
        bookingSession.id,
        bookingSession.doctorId,
      );
      return new NextResponse("OK", { status: 200 });
    }

    const cancelToken = randomBytes(32).toString("hex");
    const rescheduleToken = randomBytes(32).toString("hex");
    // Create the confirmed appointment from the booking session data
    let appointment;
    try {
      appointment = await prisma.appointment.create({
        data: {
          doctorId: bookingSession.doctorId,
          date,
          time: bookingSession.time,
          durationMinutes: bookingSession.durationMinutes,
          patientName: bookingSession.patientName,
          email: bookingSession.email,
          phone: bookingSession.phone,
          notes: bookingSession.notes,
          status: AppointmentStatus.CONFIRMED,
          consultationType:
            ConsultationType.ONLINE,
          stripePaymentId: session.id,
          paymentStatus: PaymentStatus.PAID,
          cancelToken,
          rescheduleToken,
          timezone: bookingSession.timezone,
          patientTimezone: bookingSession.patientTimezone,
        },
      });
    } catch (err) {
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        // Concurrent webhook or slot taken: prefer idempotent recovery by checkout id
        const existing = await prisma.appointment.findFirst({
          where: { stripePaymentId: session.id },
        });
        if (existing) {
          appointment = existing;
        } else {
          console.error(
            "[webhooks] P2002 creating appointment (slot conflict), bookingSession:",
            bookingSession.id,
          );
          return new NextResponse("OK", { status: 200 });
        }
      } else {
        throw err;
      }
    }

    const sessionAfter = await prisma.bookingSession.findUnique({
      where: { id: bookingSession.id },
    });
    if (sessionAfter?.status === BookingSessionStatus.COMPLETED) {
      return new NextResponse("OK", { status: 200 });
    }

    let meetLink: string | null = null;
    if (appointment.consultationType === ConsultationType.ONLINE) {
      const meet = await createMeetEventForOnlineAppointment(appointment.id);
      meetLink = meet.googleMeetUrl;
    }

    const headersList = await headers();
    const origin =
      headersList.get("origin") ??
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
      "http://localhost:3000";

    const cancelUrl = `${origin}/cancel?appointmentId=${encodeURIComponent(
      appointment.id,
    )}&token=${encodeURIComponent(appointment.cancelToken!)}`;
    const rescheduleUrl = `${origin}/reschedule?appointmentId=${encodeURIComponent(
      appointment.id,
    )}&token=${encodeURIComponent(appointment.rescheduleToken!)}`;

    // Mark the booking session as completed to avoid reprocessing
    await prisma.bookingSession.update({
      where: { id: bookingSession.id },
      data: { status: BookingSessionStatus.COMPLETED },
    });

    // Reuse existing confirmation email logic
    try {
      const { error } = await resend.emails.send({
        from: "Clinic Appointments <onboarding@resend.dev>",
        to: appointment.email,
        subject: "Appointment Confirmation",
        react: EmailTemplate({
          doctorName: doctor.name,
          appointmentDate: formatDateInPatientTz(
            bookingSession.date,
            bookingSession.time,
            bookingSession.timezone,
            bookingSession.patientTimezone,
          ),
          appointmentTime: formatTimeInPatientTz(
            bookingSession.date,
            bookingSession.time,
            bookingSession.timezone,
            bookingSession.patientTimezone,
          ),
          patientName: bookingSession.patientName,
          consultationType: bookingSession.consultationType as
            | "CLINIC"
            | "ONLINE",
          cancelUrl,
          rescheduleUrl,
          meetLink,
        }),
      });

      if (error) {
        console.error("[webhooks] Confirmation email failed:", error);
      }
    } catch (emailError) {
      console.error("[webhooks] Confirmation email failed:", emailError);
    }

    try {
      const formattedDate = formatDateInPatientTz(
        bookingSession.date,
        bookingSession.time,
        bookingSession.timezone,
        bookingSession.patientTimezone,
      );
      const formattedTime = formatTimeInPatientTz(
        bookingSession.date,
        bookingSession.time,
        bookingSession.timezone,
        bookingSession.patientTimezone,
      );
      await createAppointmentNotificationForEmail({
        patientEmail: appointment.email,
        type: NotificationType.APPOINTMENT_BOOKED,
        title: "Appointment booked",
        message: `Your appointment with ${formatDoctorDisplayName(doctor.name)} is confirmed for ${formattedDate} at ${formattedTime}.`,
      });
    } catch (err) {
      console.error("[webhooks] Failed to create patient notification:", err);
    }

    try {
      const doctorDateLabel = formatDateInDoctorTz(
        bookingSession.date,
        bookingSession.time,
        bookingSession.timezone,
      );
      const doctorTimeLabel = formatTimeInDoctorTz(
        bookingSession.date,
        bookingSession.time,
        bookingSession.timezone,
      );
      const modality =
        appointment.consultationType === ConsultationType.ONLINE
          ? "online"
          : "in-clinic";
      await createDoctorNotificationForDoctorId({
        doctorId: bookingSession.doctorId,
        type: NotificationType.APPOINTMENT_BOOKED,
        title: "New appointment booked",
        message: `${bookingSession.patientName} booked a ${modality} appointment for ${doctorDateLabel} at ${doctorTimeLabel}.`,
      });
    } catch (err) {
      console.error("[webhooks] Failed to create doctor notification:", err);
    }

    try {
      const reminderAtMs = reminderAtMsFromPatientLocal(
        bookingSession.date,
        bookingSession.time,
        bookingSession.timezone,
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
      console.error("[webhooks] Failed to schedule reminder:", err);
    }
  }

  if (
    event.type === "refund.created" ||
    event.type === "refund.updated" ||
    event.type === "refund.failed"
  ) {
    await handleRefundEvent(event);
  }

  return new NextResponse("OK", { status: 200 });
}

async function handleRefundEvent(event: Stripe.Event) {
  const refund = event.data.object as Stripe.Refund;

  // Locate the appointment this refund belongs to. Prefer the refund id we
  // persisted when initiating the refund; fall back to the payment intent for
  // refunds that were created out-of-band (e.g. manually in the Stripe dashboard).
  const paymentIntentId =
    typeof refund.payment_intent === "string"
      ? refund.payment_intent
      : (refund.payment_intent?.id ?? null);

  let appointment = await prisma.appointment.findFirst({
    where: { stripeRefundId: refund.id },
    select: {
      id: true,
      email: true,
      patientName: true,
      date: true,
      time: true,
      timezone: true,
      patientTimezone: true,
      consultationType: true,
      doctorId: true,
      refundStatus: true,
    },
  });

  if (!appointment && paymentIntentId) {
    appointment = await prisma.appointment.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
      select: {
        id: true,
        email: true,
        patientName: true,
        date: true,
        time: true,
        timezone: true,
        patientTimezone: true,
        consultationType: true,
        doctorId: true,
        refundStatus: true,
      },
    });
  }

  if (!appointment) {
    console.warn(
      "[webhooks] Refund event did not match any appointment:",
      event.type,
      refund.id,
    );
    return;
  }

  // Map the Stripe refund lifecycle (+ the dedicated refund.failed event) to
  // our internal RefundStatus. Treat anything non-final (pending / requires
  // action) as PENDING so the UI reflects "in progress" rather than "done".
  const isFailedEvent = event.type === "refund.failed";
  const nextStatus: RefundStatus = isFailedEvent
    ? RefundStatus.FAILED
    : refund.status === "succeeded"
      ? RefundStatus.SUCCEEDED
      : refund.status === "failed" || refund.status === "canceled"
        ? RefundStatus.FAILED
        : RefundStatus.PENDING;

  // Idempotency: skip if the status is unchanged, so retried webhooks don't
  // re-send failure emails or duplicate notifications.
  if (appointment.refundStatus === nextStatus) {
    return;
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      refundStatus: nextStatus,
      stripeRefundId: refund.id,
      ...(refund.amount ? { refundAmountCents: refund.amount } : {}),
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    },
  });

  if (nextStatus !== RefundStatus.FAILED) {
    return;
  }

  // Refund failure: notify the patient via email and in-app notification.
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: appointment.doctorId },
      select: { name: true },
    });
    const appointmentDate = appointment.date.toISOString().slice(0, 10);
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

    const { error } = await resend.emails.send({
      from: "Clinic Appointments <onboarding@resend.dev>",
      to: appointment.email,
      subject: "Refund Failed",
      react: EmailTemplate({
        heading: "Refund Failed",
        message:
          "We were unable to process your refund automatically. Our support team has been alerted and will reach out to resolve this as soon as possible.",
        showActionLinks: false,
        doctorName: doctor?.name ?? "Your Doctor",
        appointmentDate: formattedDate,
        appointmentTime: formattedTime,
        patientName: appointment.patientName,
        consultationType: appointment.consultationType,
        cancelUrl: "",
        rescheduleUrl: "",
      }),
    });

    if (error) {
      console.error("[webhooks] Refund-failed email failed:", error);
    }
  } catch (err) {
    console.error("[webhooks] Refund-failed email failed:", err);
  }

  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: appointment.doctorId },
      select: { name: true },
    });
    const doctorDisplayName = doctor?.name
      ? formatDoctorDisplayName(doctor.name)
      : null;
    const appointmentDate = appointment.date.toISOString().slice(0, 10);
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
      type: NotificationType.REFUND_FAILED,
      title: "Refund failed",
      message: `We could not process the refund for your appointment${
        doctorDisplayName ? ` with ${doctorDisplayName}` : ""
      } on ${formattedDate} at ${formattedTime}. Our support team will resolve this shortly.`,
    });
  } catch (err) {
    console.error(
      "[webhooks] Failed to create refund-failed notification:",
      err,
    );
  }
}
