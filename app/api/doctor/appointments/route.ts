import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import {
  AppointmentStatus,
  ConsultationType,
  NotificationType,
  PaymentStatus,
  type Prisma,
  UserRole,
} from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import {
  doctorAppointmentDateTimeOrderBy,
  doctorAppointmentDateWhere,
  mergeDoctorPatientSearch,
  normalizeDoctorDateFilter,
} from "@/lib/doctor-appointment-filters";
import { prisma } from "@/lib/db";
import { EmailTemplate } from "@/components/email-template";
import { inngest } from "@/inngest/client";
import { isDoctorTimeInPast } from "@/lib/timezone-display";
import { Resend } from "resend";
import {
  formatDateInPatientTz,
  formatTimeInPatientTz,
} from "@/lib/timezone-display";
import { createAppointmentNotificationForEmail } from "@/lib/notifications";
import { formatDoctorDisplayName } from "@/lib/doctor-name";
import { initiateRefund, refundEmailSentence } from "@/lib/refunds";
import { deleteMeetCalendarEvent } from "@/lib/google-calendar-meet";

const resend = new Resend(process.env.RESEND_API_KEY);

type TabKey = "upcoming" | "pending-review" | "completed" | "cancelled";
type CancelReason = "patient_no_show" | "doctor_unavailable";

function normalizeTab(raw: string | null): TabKey {
  if (raw === "pending-review") return "pending-review";
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
    select: { id: true, timezone: true },
  });
  if (!doctor) {
    return NextResponse.json(
      { error: "Doctor profile not found" },
      { status: 404 },
    );
  }

  const tab = normalizeTab(request.nextUrl.searchParams.get("tab"));
  const search = (request.nextUrl.searchParams.get("search") ?? "").trim();
  const dateFilter = normalizeDoctorDateFilter(
    request.nextUrl.searchParams.get("dateFilter"),
  );
  const page = Math.max(
    1,
    Number(request.nextUrl.searchParams.get("page") ?? "1") || 1,
  );
  const limit = Math.min(
    20,
    Math.max(
      5,
      Number(request.nextUrl.searchParams.get("limit") ?? "5") || 5,
    ),
  );
  const statuses =
    tab === "completed"
      ? [AppointmentStatus.COMPLETED]
      : tab === "cancelled"
        ? [AppointmentStatus.CANCELLED]
        : [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED];

  const baseWhere: Prisma.AppointmentWhereInput = {
    doctorId: doctor.id,
    status: { in: statuses },
  };

  const dateWhere = doctorAppointmentDateWhere(dateFilter, doctor.timezone);
  if (dateWhere) {
    baseWhere.date = dateWhere;
  }

  const selectedWhere = mergeDoctorPatientSearch(baseWhere, search);

  const appointments = await prisma.appointment.findMany({
    where: selectedWhere,
    orderBy: doctorAppointmentDateTimeOrderBy(dateFilter),
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
      googleMeetUrl: true,
    },
  });

  const filteredAppointments =
    tab === "pending-review"
      ? appointments.filter(
          (a) =>
            a.status === AppointmentStatus.CONFIRMED &&
            isDoctorTimeInPast(
              a.date.toISOString().slice(0, 10),
              a.time,
              a.timezone,
            ),
        )
      : tab === "upcoming"
        ? appointments.filter((a) => {
            if (a.status === AppointmentStatus.PENDING) return true;
            if (a.status !== AppointmentStatus.CONFIRMED) return false;
            return !isDoctorTimeInPast(
              a.date.toISOString().slice(0, 10),
              a.time,
              a.timezone,
            );
          })
        : appointments;
  const start = (page - 1) * limit;
  const paginatedAppointments = filteredAppointments.slice(
    start,
    start + limit,
  );

  return NextResponse.json({
    items: paginatedAppointments.map((a) => ({
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
      googleMeetUrl: a.googleMeetUrl,
    })),
    hasMore: start + limit < filteredAppointments.length,
    total: filteredAppointments.length,
    page,
  });
}

export async function PATCH(request: NextRequest) {
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
    return NextResponse.json(
      { error: "Doctor profile not found" },
      { status: 404 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    appointmentId?: string;
    reason?: unknown;
  } | null;
  const appointmentId = body?.appointmentId?.trim();
  const reasonValue = body?.reason;
  const reason: CancelReason | null =
    reasonValue === "patient_no_show" || reasonValue === "doctor_unavailable"
      ? reasonValue
      : null;
  if (!appointmentId) {
    return NextResponse.json(
      { error: "appointmentId is required" },
      { status: 400 },
    );
  }

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      doctorId: doctor.id,
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
  if (!appointment) {
    return NextResponse.json(
      { error: "Appointment not found" },
      { status: 404 },
    );
  }
  if (appointment.status === AppointmentStatus.CANCELLED) {
    return NextResponse.json(
      { error: "Appointment already cancelled" },
      { status: 409 },
    );
  }
  if (appointment.status === AppointmentStatus.COMPLETED) {
    return NextResponse.json(
      { error: "Completed appointments cannot be cancelled" },
      { status: 409 },
    );
  }

  if (appointment.googleCalendarEventId) {
    await deleteMeetCalendarEvent(appointment.googleCalendarEventId);
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      status: AppointmentStatus.CANCELLED,
      googleCalendarEventId: null,
      googleMeetUrl: null,
    },
  });

  // Refund logic (online + paid only):
  //   - reason === null (doctor cancels before start) → full refund
  //   - reason === "doctor_unavailable" (doctor missed start) → full refund
  //   - reason === "patient_no_show" → no refund
  let refundSentence: string | null = null;
  let refundFailed = false;
  const shouldRefund =
    appointment.consultationType === ConsultationType.ONLINE &&
    appointment.paymentStatus === PaymentStatus.PAID &&
    reason !== "patient_no_show";
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
    console.error("[doctor-appointments] Failed to cancel reminder:", err);
  }

  try {
    const doctorProfile = await prisma.doctor.findUnique({
      where: { id: appointment.doctorId },
      select: { name: true },
    });
    const appointmentDate = appointment.date.toISOString().slice(0, 10);
    const origin =
      request.nextUrl.origin ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";
    const bookAppointmentUrl = `${origin}/book-appointment/${encodeURIComponent(appointment.doctorId)}`;
    const emailSubject =
      reason === "patient_no_show"
        ? "Missed Appointment"
        : reason === "doctor_unavailable"
          ? "Appointment Update"
          : "Appointment Cancelled";
    const emailHeading =
      reason === "patient_no_show"
        ? "Missed Appointment"
        : reason === "doctor_unavailable"
          ? "Doctor Was Unavailable"
          : "Appointment Cancelled";
    const baseEmailMessage =
      reason === "patient_no_show"
        ? "You missed this appointment because you did not show up. If needed, please book a new appointment from our website."
        : reason === "doctor_unavailable"
          ? "Your doctor was unavailable for this appointment. We apologize for the inconvenience. Please book another appointment from our website."
          : "Your doctor has cancelled this appointment. If needed, please book a new appointment from our website.";

    // Append a refund sentence when a refund was initiated or failed; for
    // patient_no_show the refund step is skipped, so this stays null.
    const refundAppendix = refundSentence
      ? ` ${refundSentence}`
      : refundFailed
        ? " We attempted to initiate your refund but ran into an issue. Our support team will follow up shortly to resolve it."
        : "";
    const emailMessage = `${baseEmailMessage}${refundAppendix}`;

    const { error } = await resend.emails.send({
      from: "Clinic Appointments <onboarding@resend.dev>",
      to: appointment.email,
      subject: emailSubject,
      react: EmailTemplate({
        heading: emailHeading,
        message: emailMessage,
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
      }),
    });

    if (error) {
      console.error("[doctor-appointments] Cancellation email failed:", error);
    }
  } catch (err) {
    console.error("[doctor-appointments] Cancellation email failed:", err);
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
    console.error("[doctor-appointments] Failed to create notification:", err);
  }

  return NextResponse.json({ ok: true });
}
