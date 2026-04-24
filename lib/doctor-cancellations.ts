import { EmailTemplate } from "@/components/email-template";
import {
  AppointmentStatus,
  ConsultationType,
  NotificationType,
  PaymentStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { formatDoctorDisplayName } from "@/lib/doctor-name";
import { deleteMeetCalendarEvent } from "@/lib/google-calendar-meet";
import { createAppointmentNotificationForEmail } from "@/lib/notifications";
import { initiateRefund, refundEmailSentence } from "@/lib/refunds";
import { inngest } from "@/inngest/client";
import {
  formatDateInPatientTz,
  formatTimeInPatientTz,
} from "@/lib/timezone-display";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type CancelReason = "patient_no_show" | "doctor_unavailable" | "doctor_holiday" | null;

function cancellationContent(reason: CancelReason) {
  if (reason === "patient_no_show") {
    return {
      subject: "Missed Appointment",
      heading: "Missed Appointment",
      message:
        "You missed this appointment because you did not show up. If needed, please book a new appointment from our website.",
    };
  }
  if (reason === "doctor_unavailable") {
    return {
      subject: "Appointment Update",
      heading: "Doctor Was Unavailable",
      message:
        "Your doctor was unavailable for this appointment. We apologize for the inconvenience. Please book another appointment from our website.",
    };
  }
  if (reason === "doctor_holiday") {
    return {
      subject: "Appointment Cancelled",
      heading: "Appointment Cancelled",
      message:
        "Your doctor has marked this date as a holiday, so your appointment has been cancelled. Please book another appointment from our website.",
    };
  }
  return {
    subject: "Appointment Cancelled",
    heading: "Appointment Cancelled",
    message:
      "Your doctor has cancelled this appointment. If needed, please book a new appointment from our website.",
  };
}

export async function cancelAppointmentByDoctor(input: {
  appointmentId: string;
  doctorId: string;
  reason: CancelReason;
  requestOrigin?: string;
}) {
  const appointment = await prisma.appointment.findFirst({
    where: {
      id: input.appointmentId,
      doctorId: input.doctorId,
    },
    select: {
      id: true,
      status: true,
      email: true,
      patientName: true,
      date: true,
      time: true,
      timezone: true,
      patientTimezone: true,
      consultationType: true,
      doctorId: true,
      paymentStatus: true,
      stripePaymentId: true,
      stripePaymentIntentId: true,
      refundStatus: true,
      googleCalendarEventId: true,
    },
  });
  if (!appointment) return { ok: false as const, code: "NOT_FOUND" as const };
  if (appointment.status === AppointmentStatus.CANCELLED) {
    return { ok: false as const, code: "ALREADY_CANCELLED" as const };
  }
  if (appointment.status === AppointmentStatus.COMPLETED) {
    return { ok: false as const, code: "COMPLETED" as const };
  }

  if (appointment.googleCalendarEventId) {
    await deleteMeetCalendarEvent(appointment.doctorId, appointment.googleCalendarEventId);
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      status: AppointmentStatus.CANCELLED,
      googleCalendarEventId: null,
      googleMeetUrl: null,
    },
  });

  let refundSentence: string | null = null;
  let refundFailed = false;
  const shouldRefund =
    appointment.consultationType === ConsultationType.ONLINE &&
    appointment.paymentStatus === PaymentStatus.PAID &&
    input.reason !== "patient_no_show";

  if (shouldRefund) {
    const result = await initiateRefund({
      appointment: {
        id: appointment.id,
        consultationType: appointment.consultationType,
        paymentStatus: appointment.paymentStatus,
        stripePaymentId: appointment.stripePaymentId,
        stripePaymentIntentId: appointment.stripePaymentIntentId,
        refundStatus: appointment.refundStatus,
      },
      percentage: 100,
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
        appointmentId: appointment.id,
      },
    });
  } catch (err) {
    console.error("[doctor-cancellations] Failed to cancel reminder:", err);
  }

  try {
    const doctorProfile = await prisma.doctor.findUnique({
      where: { id: appointment.doctorId },
      select: { name: true },
    });
    const appointmentDate = appointment.date.toISOString().slice(0, 10);
    const origin =
      input.requestOrigin ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";
    const bookAppointmentUrl = `${origin}/book-appointment/${encodeURIComponent(appointment.doctorId)}`;
    const copy = cancellationContent(input.reason);
    const refundAppendix = refundSentence
      ? ` ${refundSentence}`
      : refundFailed
        ? " We attempted to initiate your refund but ran into an issue. Our support team will follow up shortly to resolve it."
        : "";
    const message = `${copy.message}${refundAppendix}`;

    const { error } = await resend.emails.send({
      from: "Clinic Appointments <onboarding@resend.dev>",
      to: appointment.email,
      subject: copy.subject,
      react: EmailTemplate({
        heading: copy.heading,
        message,
        showActionLinks: true,
        primaryActionLabel: "Book appointment",
        primaryActionUrl: bookAppointmentUrl,
        secondaryActionLabel: undefined,
        secondaryActionUrl: undefined,
        doctorName: doctorProfile?.name ?? "Your Doctor",
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
        showOnlineContactFallback: false,
      }),
    });

    if (error) {
      console.error("[doctor-cancellations] Cancellation email failed:", error);
    }
  } catch (err) {
    console.error("[doctor-cancellations] Cancellation email failed:", err);
  }

  try {
    const doctorProfile = await prisma.doctor.findUnique({
      where: { id: appointment.doctorId },
      select: { name: true },
    });
    const doctorDisplayName = doctorProfile?.name
      ? formatDoctorDisplayName(doctorProfile.name)
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
      type: NotificationType.APPOINTMENT_CANCELLED,
      title: "Appointment cancelled",
      message: `Your appointment${
        doctorDisplayName ? ` with ${doctorDisplayName}` : ""
      } on ${formattedDate} at ${formattedTime} was cancelled by your doctor.`,
    });
  } catch (err) {
    console.error("[doctor-cancellations] Failed to create notification:", err);
  }

  return { ok: true as const };
}
