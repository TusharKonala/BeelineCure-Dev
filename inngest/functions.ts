import { EmailTemplate } from "@/components/email-template";
import { MedicineReminderEmailTemplate } from "@/components/medicine-reminder-email-template";
import { prisma } from "@/lib/db";
import { AppointmentStatus, NotificationType } from "@/generated/prisma/client";
import { Resend } from "resend";
import { inngest } from "./client";
import {
  doctorLocalToUtc,
  formatDateInDoctorTz,
  formatTimeInDoctorTz,
  formatDateInPatientTz,
  formatTimeInPatientTz,
} from "@/lib/timezone-display";
import {
  createAppointmentNotificationForEmail,
  createDoctorNotificationForDoctorId,
} from "@/lib/notifications";
import { formatDoctorDisplayName } from "@/lib/doctor-name";

const resend = new Resend(process.env.RESEND_API_KEY);

type PrescriptionReminderType = "HALFWAY" | "COMPLETED";
const OVERDUE_IN_APP_MS = 24 * 60 * 60 * 1000;
const OVERDUE_EMAIL_MS = 48 * 60 * 60 * 1000;

function isReminderEligibleAppointmentStatus(status: AppointmentStatus): boolean {
  return status === AppointmentStatus.CONFIRMED;
}

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
        googleMeetUrl: true,
        doctor: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!appointment) return { skipped: true, reason: "not_found" };
    if (!isReminderEligibleAppointmentStatus(appointment.status)) {
      return { skipped: true, reason: "inactive_status" };
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
        meetLink: appointment.googleMeetUrl,
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

/**
 * 15-minute "join now" reminder for ONLINE appointments only. Sends an email
 * to both the patient and the doctor (when the doctor has a linked user
 * account with an email) and includes the Google Meet link. Scheduled at
 * appointment start − 15 minutes from booking + reschedule sites; cancelled
 * via `appointment/online-reminder-t15.cancelled`.
 */
export const sendOnlineAppointmentT15Reminder = inngest.createFunction(
  {
    id: "send-online-appointment-t15-reminder",
    retries: 2,
    triggers: [{ event: "appointment/online-reminder-t15.scheduled" }],
    cancelOn: [
      {
        event: "appointment/online-reminder-t15.cancelled",
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
        googleMeetUrl: true,
        doctor: {
          select: {
            name: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
    });

    if (!appointment) return { skipped: true, reason: "not_found" };
    if (appointment.consultationType !== "ONLINE") {
      return { skipped: true, reason: "not_online" };
    }
    if (!isReminderEligibleAppointmentStatus(appointment.status)) {
      return { skipped: true, reason: "inactive_status" };
    }

    const dateStr = appointment.date.toISOString().slice(0, 10);
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
      "http://localhost:3000";
    const cancelUrl = appointment.cancelToken
      ? `${origin}/cancel?appointmentId=${encodeURIComponent(
          appointment.id,
        )}&token=${encodeURIComponent(appointment.cancelToken)}`
      : "";
    const rescheduleUrl = appointment.rescheduleToken
      ? `${origin}/reschedule?appointmentId=${encodeURIComponent(
          appointment.id,
        )}&token=${encodeURIComponent(appointment.rescheduleToken)}`
      : "";

    const message =
      "Your online consultation starts in about 15 minutes. Use the Google Meet link below to join.";

    const patientSend = await resend.emails.send({
      from: "Clinic Appointments <onboarding@resend.dev>",
      to: appointment.email,
      subject: "Your online consultation starts in 15 minutes",
      react: EmailTemplate({
        heading: "Starting soon",
        message,
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
        meetLink: appointment.googleMeetUrl,
      }),
    });

    const doctorEmail = appointment.doctor.user?.email?.trim();
    let doctorSendError: unknown = null;
    if (doctorEmail) {
      const doctorSend = await resend.emails.send({
        from: "Clinic Appointments <onboarding@resend.dev>",
        to: doctorEmail,
        subject: `Online consultation with ${appointment.patientName} starts in 15 minutes`,
        react: EmailTemplate({
          heading: "Online consultation starting soon",
          message: `Your online consultation with ${appointment.patientName} starts in about 15 minutes. Use the Google Meet link below to join.`,
          showActionLinks: false,
          doctorName: appointment.doctor.name,
          appointmentDate: formatDateInDoctorTz(
            dateStr,
            appointment.time,
            appointment.timezone,
          ),
          appointmentTime: formatTimeInDoctorTz(
            dateStr,
            appointment.time,
            appointment.timezone,
          ),
          patientName: appointment.patientName,
          consultationType: appointment.consultationType,
          cancelUrl: "",
          rescheduleUrl: "",
          meetLink: appointment.googleMeetUrl,
        }),
      });
      doctorSendError = doctorSend.error ?? null;
    }

    try {
      await createAppointmentNotificationForEmail({
        patientEmail: appointment.email,
        type: NotificationType.APPOINTMENT_REMINDER,
        title: "Consultation starts in 15 minutes",
        message: `Your online consultation with ${formatDoctorDisplayName(
          appointment.doctor.name,
        )} starts in 15 minutes. Use the Google Meet link in your appointment email to join.`,
      });
      await createDoctorNotificationForDoctorId({
        doctorId: appointment.doctorId,
        type: NotificationType.APPOINTMENT_REMINDER,
        title: "Online consultation starts in 15 minutes",
        message: `Your online consultation with ${appointment.patientName} starts in 15 minutes.`,
      });
    } catch (err) {
      console.error(
        "[appointments-t15-reminder] Failed to create notifications:",
        err,
      );
    }

    if (patientSend.error) {
      throw new Error(
        `[appointments-t15-reminder] Patient email failed: ${JSON.stringify(
          patientSend.error,
        )}`,
      );
    }
    if (doctorSendError) {
      throw new Error(
        `[appointments-t15-reminder] Doctor email failed: ${JSON.stringify(
          doctorSendError,
        )}`,
      );
    }

    return {
      sent: true,
      appointmentId,
      patientNotified: true,
      doctorNotified: Boolean(doctorEmail),
    };
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

export const processDoctorOverdueAppointments = inngest.createFunction(
  {
    id: "process-doctor-overdue-appointments",
    retries: 1,
    triggers: [{ cron: "0 * * * *" }],
  },
  async () => {
    const now = new Date();
    const appointments = await prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.CONFIRMED,
        OR: [{ overdueInAppNotifiedAt: null }, { overdueEmailNotifiedAt: null }],
      },
      select: {
        id: true,
        date: true,
        time: true,
        timezone: true,
        patientName: true,
        consultationType: true,
        overdueInAppNotifiedAt: true,
        overdueEmailNotifiedAt: true,
        doctor: {
          select: {
            id: true,
            name: true,
            lastSeenAt: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
    });

    let inAppCreated = 0;
    let emailSent = 0;

    for (const appointment of appointments) {
      const dateStr = appointment.date.toISOString().slice(0, 10);
      const appointmentStartAt = doctorLocalToUtc(
        dateStr,
        appointment.time,
        appointment.timezone,
      );
      const overdueMs = now.getTime() - appointmentStartAt.getTime();
      if (overdueMs < OVERDUE_IN_APP_MS) continue;

      if (!appointment.overdueInAppNotifiedAt) {
        const claimed = await prisma.appointment.updateMany({
          where: {
            id: appointment.id,
            status: AppointmentStatus.CONFIRMED,
            overdueInAppNotifiedAt: null,
          },
          data: { overdueInAppNotifiedAt: now },
        });
        if (claimed.count > 0) {
          try {
            await createDoctorNotificationForDoctorId({
              doctorId: appointment.doctor.id,
              type: NotificationType.APPOINTMENT_REMINDER,
              title: "Overdue appointment pending review",
              message: `Appointment with ${appointment.patientName} (${appointment.consultationType === "ONLINE" ? "Online consultation" : "Clinic visit"}) on ${formatDateInDoctorTz(
                dateStr,
                appointment.time,
                appointment.timezone,
              )} at ${formatTimeInDoctorTz(
                dateStr,
                appointment.time,
                appointment.timezone,
              )} is still marked as confirmed. Please mark it as Completed or Cancelled.`,
            });
            inAppCreated += 1;
          } catch (err) {
            await prisma.appointment.update({
              where: { id: appointment.id },
              data: { overdueInAppNotifiedAt: null },
            });
            console.error("[doctor-overdue] Failed to create in-app notification:", err);
          }
        }
      }

      if (overdueMs < OVERDUE_EMAIL_MS || appointment.overdueEmailNotifiedAt) {
        continue;
      }
      const doctorSeenAt = appointment.doctor.lastSeenAt;
      const shouldFallbackToEmail =
        !doctorSeenAt ||
        doctorSeenAt.getTime() < appointmentStartAt.getTime() + OVERDUE_EMAIL_MS;
      const doctorEmail = appointment.doctor.user?.email?.trim();
      if (!shouldFallbackToEmail || !doctorEmail) {
        continue;
      }

      const claimTime = new Date();
      const claimed = await prisma.appointment.updateMany({
        where: {
          id: appointment.id,
          status: AppointmentStatus.CONFIRMED,
          overdueEmailNotifiedAt: null,
        },
        data: { overdueEmailNotifiedAt: claimTime },
      });
      if (claimed.count === 0) continue;

      const { error } = await resend.emails.send({
        from: "Clinic Appointments <onboarding@resend.dev>",
        to: doctorEmail,
        subject: "Action needed: appointment pending review",
        react: EmailTemplate({
          heading: "Appointment pending review",
          message: `Appointment with ${appointment.patientName} is overdue by more than 48 hours and is still marked as confirmed. Please mark it as Completed or Cancelled.`,
          showActionLinks: false,
          doctorName: appointment.doctor.name,
          appointmentDate: formatDateInDoctorTz(
            dateStr,
            appointment.time,
            appointment.timezone,
          ),
          appointmentTime: formatTimeInDoctorTz(
            dateStr,
            appointment.time,
            appointment.timezone,
          ),
          patientName: appointment.patientName,
          consultationType: appointment.consultationType,
          cancelUrl: "",
          rescheduleUrl: "",
        }),
      });

      if (error) {
        await prisma.appointment.updateMany({
          where: {
            id: appointment.id,
            overdueEmailNotifiedAt: claimTime,
          },
          data: { overdueEmailNotifiedAt: null },
        });
        console.error("[doctor-overdue] Fallback email failed:", error);
        continue;
      }

      emailSent += 1;
    }

    return {
      scanned: appointments.length,
      inAppCreated,
      emailSent,
    };
  },
);

