import { EmailTemplate } from "@/components/email-template";
import { MedicineReminderEmailTemplate } from "@/components/medicine-reminder-email-template";
import { prisma } from "@/lib/db";
import { AppointmentStatus, NotificationType } from "@/generated/prisma/client";
import { Resend } from "resend";
import { inngest } from "./client";
import {
  formatDateInPatientTz,
  formatTimeInPatientTz,
} from "@/lib/timezone-display";
import { createAppointmentNotificationForEmail } from "@/lib/notifications";
import { formatDoctorDisplayName } from "@/lib/doctor-name";

const resend = new Resend(process.env.RESEND_API_KEY);

type PrescriptionReminderType = "HALFWAY" | "COMPLETED";
type PrescriptionPatientNotificationKind = "READY" | "UPDATED";

function formatDaysValue(days: number): string {
  return Number.isInteger(days) ? String(days) : String(Number(days.toFixed(1)));
}

function extractMedicineSummary(
  medicines: unknown,
): { count: number; maxDurationDays: number } | null {
  if (!Array.isArray(medicines) || medicines.length === 0) return null;
  let maxDurationDays = 0;
  for (const item of medicines) {
    if (!item || typeof item !== "object") return null;
    const duration = Number((item as { durationDays?: unknown }).durationDays);
    if (!Number.isInteger(duration) || duration <= 0) return null;
    maxDurationDays = Math.max(maxDurationDays, duration);
  }
  return { count: medicines.length, maxDurationDays };
}

export const sendAppointmentReminder = inngest.createFunction(
  {
    id: "send-appointment-reminder",
    retries: 2,
    triggers: [{ event: "appointment/reminder.scheduled" }],
    cancelOn: [
      {
        event: "appointment/reminder.cancelled",
        match: "data.appointmentId",
      },
    ],
  },
  async ({ event }) => {
    const { appointmentId } = event.data as { appointmentId: string };

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        doctorId: true,
        email: true,
        date: true,
        time: true,
        timezone: true,
        patientTimezone: true,
        patientName: true,
        consultationType: true,
        status: true,
        cancelToken: true,
        rescheduleToken: true,
        doctor: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!appointment) return { skipped: true, reason: "not_found" };
    if (appointment.status === AppointmentStatus.CANCELLED) {
      return { skipped: true, reason: "cancelled" };
    }
    if (appointment.status === AppointmentStatus.COMPLETED) {
      return { skipped: true, reason: "completed" };
    }
    if (!appointment.cancelToken || !appointment.rescheduleToken) {
      return { skipped: true, reason: "missing_tokens" };
    }

    const dateStr = appointment.date.toISOString().slice(0, 10);
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
      "http://localhost:3000";
    const cancelUrl = `${origin}/cancel?appointmentId=${encodeURIComponent(
      appointment.id,
    )}&token=${encodeURIComponent(appointment.cancelToken)}`;
    const rescheduleUrl = `${origin}/reschedule?appointmentId=${encodeURIComponent(
      appointment.id,
    )}&token=${encodeURIComponent(appointment.rescheduleToken)}`;

    const { error } = await resend.emails.send({
      from: "Clinic Appointments <onboarding@resend.dev>",
      to: appointment.email,
      subject: "Appointment Reminder",
      react: EmailTemplate({
        heading: "Appointment Reminder",
        message:
          "This is a reminder that your appointment is scheduled in 24 hours. If you need to cancel or reschedule, please use the links below.",
        showActionLinks: true,
        doctorName: appointment.doctor.name,
        appointmentDate: formatDateInPatientTz(
          dateStr,
          appointment.time,
          appointment.timezone,
          appointment.patientTimezone,
        ),
        appointmentTime: formatTimeInPatientTz(
          dateStr,
          appointment.time,
          appointment.timezone,
          appointment.patientTimezone,
        ),
        patientName: appointment.patientName,
        consultationType: appointment.consultationType,
        cancelUrl,
        rescheduleUrl,
      }),
    });

    try {
      const doctorDisplayName = formatDoctorDisplayName(appointment.doctor.name);
      await createAppointmentNotificationForEmail({
        patientEmail: appointment.email,
        type: NotificationType.APPOINTMENT_REMINDER,
        title: "Appointment reminder",
        message: `Reminder: your appointment with ${doctorDisplayName} is on ${formatDateInPatientTz(
          dateStr,
          appointment.time,
          appointment.timezone,
          appointment.patientTimezone,
        )} at ${formatTimeInPatientTz(
          dateStr,
          appointment.time,
          appointment.timezone,
          appointment.patientTimezone,
        )}.`,
      });
    } catch (err) {
      console.error("[appointments-reminder] Failed to create notification:", err);
    }

    if (error) {
      throw new Error(
        `[appointments-reminder] Reminder email failed: ${JSON.stringify(error)}`,
      );
    }

    return { sent: true, appointmentId };
  },
);

export const sendPrescriptionReminder = inngest.createFunction(
  {
    id: "send-prescription-reminder",
    retries: 2,
    triggers: [{ event: "prescription/reminder.scheduled" }],
  },
  async ({ event }) => {
    const { appointmentId, reminderType } = event.data as {
      appointmentId: string;
      reminderType: PrescriptionReminderType;
    };

    if (reminderType !== "HALFWAY" && reminderType !== "COMPLETED") {
      return { skipped: true, reason: "invalid_reminder_type" };
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        doctorId: true,
        email: true,
        date: true,
        time: true,
        timezone: true,
        patientTimezone: true,
        patientName: true,
        consultationType: true,
        status: true,
        doctor: {
          select: {
            name: true,
          },
        },
        prescription: {
          select: {
            medicines: true,
          },
        },
      },
    });

    if (!appointment) return { skipped: true, reason: "not_found" };
    if (appointment.status === AppointmentStatus.CANCELLED) {
      return { skipped: true, reason: "cancelled" };
    }
    if (!appointment.prescription) {
      return { skipped: true, reason: "missing_prescription" };
    }

    const medicineSummary = extractMedicineSummary(appointment.prescription.medicines);
    if (!medicineSummary) {
      return { skipped: true, reason: "invalid_medicines_payload" };
    }

    const maxDurationDays = medicineSummary.maxDurationDays;
    const halfwayDays = maxDurationDays / 2;
    const courseDaysText = `${formatDaysValue(maxDurationDays)} day${
      maxDurationDays === 1 ? "" : "s"
    }`;
    const halfwayDaysText = `${formatDaysValue(halfwayDays)} day${
      halfwayDays === 1 ? "" : "s"
    }`;
    const subject =
      reminderType === "HALFWAY"
        ? "Medication Reminder: Halfway Through"
        : "Medication Reminder: Course Completed";
    const heading =
      reminderType === "HALFWAY" ? "Medication Progress Check-in" : "Medication Course Completed";
    const message =
      reminderType === "HALFWAY"
        ? `You are halfway through your medication course (${halfwayDaysText}). Please continue your prescribed medicines as advised by your doctor.`
        : `You have completed your medication course (${courseDaysText}). If needed, you can book a follow-up consultation with the same doctor.`;
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
      "http://localhost:3000";
    const viewPrescriptionUrl = `${origin}/patient/appointments/${encodeURIComponent(
      appointment.id,
    )}/prescription`;
    const followUpUrl = `${origin}/book-appointment/${encodeURIComponent(appointment.doctorId)}`;

    const { error } = await resend.emails.send({
      from: "Clinic Appointments <onboarding@resend.dev>",
      to: appointment.email,
      subject,
      react: MedicineReminderEmailTemplate({
        heading,
        message,
        doctorName: appointment.doctor.name,
        patientName: appointment.patientName,
        primaryActionLabel:
          reminderType === "HALFWAY" ? "View prescription" : "Book a follow-up if needed",
        primaryActionUrl:
          reminderType === "HALFWAY" ? viewPrescriptionUrl : followUpUrl,
        secondaryActionLabel:
          reminderType === "HALFWAY" ? "Book a follow-up if needed" : undefined,
        secondaryActionUrl: reminderType === "HALFWAY" ? followUpUrl : undefined,
      }),
    });

    if (error) {
      throw new Error(
        `[prescription-reminder] Reminder email failed: ${JSON.stringify(error)}`,
      );
    }

    return { sent: true, appointmentId, reminderType };
  },
);

export const sendPrescriptionPatientNotification = inngest.createFunction(
  {
    id: "send-prescription-patient-notification",
    retries: 2,
    triggers: [{ event: "prescription/patient-notification" }],
  },
  async ({ event }) => {
    const { appointmentId, kind } = event.data as {
      appointmentId: string;
      kind: PrescriptionPatientNotificationKind;
    };
    console.info("[prescription-debug] handler invoked", {
      eventName: event.name,
      appointmentId,
      kind,
    });

    if (kind !== "READY" && kind !== "UPDATED") {
      console.warn("[prescription-debug] handler invalid kind", {
        appointmentId,
        kind,
      });
      return { skipped: true, reason: "invalid_kind" };
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        email: true,
        patientName: true,
        date: true,
        time: true,
        timezone: true,
        patientTimezone: true,
        consultationType: true,
        status: true,
        doctor: {
          select: {
            name: true,
          },
        },
        prescription: {
          select: {
            appointmentId: true,
          },
        },
      },
    });

    if (!appointment) {
      console.warn("[prescription-debug] handler missing appointment", {
        appointmentId,
        kind,
      });
      return { skipped: true, reason: "not_found" };
    }
    if (appointment.status === AppointmentStatus.CANCELLED) {
      console.warn("[prescription-debug] handler appointment cancelled", {
        appointmentId,
        kind,
        status: appointment.status,
      });
      return { skipped: true, reason: "cancelled" };
    }
    if (!appointment.prescription) {
      console.warn("[prescription-debug] handler missing prescription", {
        appointmentId,
        kind,
        status: appointment.status,
      });
      return { skipped: true, reason: "missing_prescription" };
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
      "http://localhost:3000";
    const viewPrescriptionUrl = `${origin}/patient/appointments/${encodeURIComponent(
      appointment.id,
    )}/prescription`;
    const subject =
      kind === "READY" ? "Your prescription is ready" : "Your prescription has been updated";
    const heading =
      kind === "READY" ? "Prescription Ready" : "Prescription Updated";
    const dateStr = appointment.date.toISOString().slice(0, 10);
    const doctorDisplayName = formatDoctorDisplayName(appointment.doctor.name);
    const formattedDate = formatDateInPatientTz(
      dateStr,
      appointment.time,
      appointment.timezone,
      appointment.patientTimezone,
    );
    const formattedTime = formatTimeInPatientTz(
      dateStr,
      appointment.time,
      appointment.timezone,
      appointment.patientTimezone,
    );
    const message =
      kind === "READY"
        ? `Your prescription from ${doctorDisplayName} is now ready. You can review it online from your appointments.`
        : `Your prescription from ${doctorDisplayName} has been updated. Please review the latest version in your appointments.`;
    const notificationTitle =
      kind === "READY" ? "Prescription ready" : "Prescription updated";
    const notificationMessage =
      kind === "READY"
        ? `Your prescription from ${doctorDisplayName} is ready for your appointment on ${formattedDate} at ${formattedTime}.`
        : `Your prescription from ${doctorDisplayName} was updated for your appointment on ${formattedDate} at ${formattedTime}.`;
    console.info("[prescription-debug] handler reached delivery step", {
      appointmentId,
      kind,
      appointmentStatus: appointment.status,
      hasPrescription: Boolean(appointment.prescription),
    });

    const { error } = await resend.emails.send({
      from: "Clinic Appointments <onboarding@resend.dev>",
      to: appointment.email,
      subject,
      react: MedicineReminderEmailTemplate({
        heading,
        message,
        doctorName: appointment.doctor.name,
        patientName: appointment.patientName,
        primaryActionLabel: "View prescription",
        primaryActionUrl: viewPrescriptionUrl,
      }),
    });

    try {
      await createAppointmentNotificationForEmail({
        patientEmail: appointment.email,
        type: NotificationType.APPOINTMENT_REMINDER,
        title: notificationTitle,
        message: notificationMessage,
      });
    } catch (err) {
      console.error("[prescription-notification] Failed to create notification:", err);
    }

    if (error) {
      throw new Error(
        `[prescription-notification] Email failed: ${JSON.stringify(error)}`,
      );
    }
    console.info("[prescription-debug] handler completed", {
      appointmentId,
      kind,
      emailDelivered: true,
    });

    return { sent: true, appointmentId, kind };
  },
);
