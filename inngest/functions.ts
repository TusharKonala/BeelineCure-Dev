import { EmailTemplate } from "@/components/email-template";
import { prisma } from "@/lib/db";
import { AppointmentStatus } from "@/generated/prisma/client";
import { Resend } from "resend";
import { inngest } from "./client";

const resend = new Resend(process.env.RESEND_API_KEY);

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
        email: true,
        date: true,
        time: true,
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
    if (!appointment.cancelToken || !appointment.rescheduleToken) {
      return { skipped: true, reason: "missing_tokens" };
    }

    const appointmentDate = appointment.date.toISOString().slice(0, 10);
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
        appointmentDate,
        appointmentTime: appointment.time,
        patientName: appointment.patientName,
        consultationType: appointment.consultationType,
        cancelUrl,
        rescheduleUrl,
      }),
    });

    if (error) {
      throw new Error(
        `[appointments-reminder] Reminder email failed: ${JSON.stringify(error)}`,
      );
    }

    return { sent: true, appointmentId };
  },
);
