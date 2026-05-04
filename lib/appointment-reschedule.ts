import { EmailTemplate } from "@/components/email-template";
import {
  AppointmentStatus,
  ConsultationType,
  NotificationType,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { formatDoctorDisplayName } from "@/lib/doctor-name";
import { updateMeetEventForOnlineAppointment } from "@/lib/google-calendar-meet";
import { inngest } from "@/inngest/client";
import { createAppointmentNotificationForEmail } from "@/lib/notifications";
import { reminderAtMsFromPatientLocal } from "@/lib/reminder-time";
import {
  formatDateInPatientTz,
  formatTimeInPatientTz,
} from "@/lib/timezone-display";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export type RescheduleAppointmentRow = {
  id: string;
  doctorId: string;
  email: string;
  patientName: string;
  consultationType: ConsultationType;
  timezone: string;
  patientTimezone: string;
  cancelToken: string | null;
  rescheduleToken: string | null;
};

/**
 * Moves an appointment to a new slot (same notification + calendar flow as patient reschedule).
 * Caller must validate auth / tokens and that the appointment is reschedulable.
 * `date` must be the UTC midnight-normalized date used by Prisma `@db.Date` (same as `parseDateOnly` in the API route).
 */
export async function reschedulePatientAppointment(input: {
  appointment: RescheduleAppointmentRow;
  /** YYYY-MM-DD for reminders and email copy */
  dateParam: string;
  /** Parsed calendar date for DB conflict + update */
  date: Date;
  time: string;
  patientTimezoneOverride?: string;
  requestOrigin: string;
}): Promise<{ ok: true } | { ok: false; code: "slot_unavailable" }> {
  const { appointment, dateParam, date, time, patientTimezoneOverride, requestOrigin } =
    input;

  const conflict = await prisma.appointment.findFirst({
    where: {
      doctorId: appointment.doctorId,
      date,
      time,
      status: { not: AppointmentStatus.CANCELLED },
      id: { not: appointment.id },
    },
  });

  if (conflict) {
    return { ok: false, code: "slot_unavailable" };
  }

  const updatedAppointment = await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      date,
      time,
      ...(patientTimezoneOverride
        ? { patientTimezone: patientTimezoneOverride }
        : {}),
    },
  });

  if (updatedAppointment.consultationType === ConsultationType.ONLINE) {
    await updateMeetEventForOnlineAppointment(updatedAppointment.id);
  }

  try {
    await inngest.send({
      name: "appointment/reminder.cancelled",
      data: {
        appointmentId: updatedAppointment.id,
      },
    });

    const reminderAtMs = reminderAtMsFromPatientLocal(
      dateParam,
      time,
      appointment.timezone,
    );

    if (reminderAtMs !== null) {
      await inngest.send({
        name: "appointment/reminder.scheduled",
        data: {
          appointmentId: updatedAppointment.id,
        },
        ts: reminderAtMs,
      });
    }
  } catch (err) {
    console.error("[appointment-reschedule] Failed to re-schedule reminder:", err);
  }

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
        "[appointment-reschedule] Missing doctor/email/tokens; skipping confirmation email.",
      );
    } else {
      const origin =
        requestOrigin ||
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
        "http://localhost:3000";

      const cancelUrl = `${origin}/cancel?appointmentId=${encodeURIComponent(
        updatedAppointment.id,
      )}&token=${encodeURIComponent(updatedAppointment.cancelToken)}`;
      const rescheduleUrl = `${origin}/reschedule?appointmentId=${encodeURIComponent(
        updatedAppointment.id,
      )}&token=${encodeURIComponent(updatedAppointment.rescheduleToken)}`;

      const latestMeet = await prisma.appointment.findUnique({
        where: { id: updatedAppointment.id },
        select: { googleMeetUrl: true },
      });

      const { error } = await resend.emails.send({
        from: "Clinic Appointments <onboarding@resend.dev>",
        to: updatedAppointment.email,
        subject: "Appointment Rescheduled",
        react: EmailTemplate({
          heading: "Appointment Rescheduled",
          message:
            updatedAppointment.consultationType === ConsultationType.ONLINE
              ? "Your appointment has been rescheduled. Please be available at the scheduled time. To cancel or reschedule, use the links below."
              : "Your appointment has been rescheduled. Please arrive a few minutes early. To cancel or reschedule, use the links below.",
          doctorName: doctor.name,
          appointmentDate: formatDateInPatientTz(
            dateParam,
            time,
            updatedAppointment.timezone,
            updatedAppointment.patientTimezone,
          ),
          appointmentTime: formatTimeInPatientTz(
            dateParam,
            time,
            updatedAppointment.timezone,
            updatedAppointment.patientTimezone,
          ),
          patientName: updatedAppointment.patientName,
          consultationType: updatedAppointment.consultationType,
          cancelUrl,
          rescheduleUrl,
          meetLink: latestMeet?.googleMeetUrl ?? null,
        }),
      });

      if (error) {
        console.error("[appointment-reschedule] Confirmation email failed:", error);
      }
    }
  } catch (err) {
    console.error("[appointment-reschedule] Confirmation email failed:", err);
  }

  try {
    const formattedDate = formatDateInPatientTz(
      dateParam,
      time,
      updatedAppointment.timezone,
      updatedAppointment.patientTimezone,
    );
    const formattedTime = formatTimeInPatientTz(
      dateParam,
      time,
      updatedAppointment.timezone,
      updatedAppointment.patientTimezone,
    );
    const doctor = await prisma.doctor.findUnique({
      where: { id: updatedAppointment.doctorId },
      select: { name: true },
    });
    const doctorDisplayName = doctor?.name
      ? formatDoctorDisplayName(doctor.name)
      : null;
    await createAppointmentNotificationForEmail({
      patientEmail: updatedAppointment.email,
      type: NotificationType.APPOINTMENT_RESCHEDULED,
      title: "Appointment rescheduled",
      message: `Your appointment${
        doctorDisplayName ? ` with ${doctorDisplayName}` : ""
      } is now set for ${formattedDate} at ${formattedTime}.`,
    });
  } catch (err) {
    console.error("[appointment-reschedule] Failed to create notification:", err);
  }

  return { ok: true };
}
