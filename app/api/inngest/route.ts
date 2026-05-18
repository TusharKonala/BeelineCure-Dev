import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  processDoctorOverdueAppointments,
  screenCareersApplication,
  sendAppointmentReminder,
  sendCareersApplicationDigest,
  sendInterviewReminder24h,
  sendInterviewReminder30m,
  sendClinicAppointmentT120Reminder,
  sendOnlineAppointmentT15Reminder,
  sendPrescriptionReminder,
} from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sendAppointmentReminder,
    sendOnlineAppointmentT15Reminder,
    sendClinicAppointmentT120Reminder,
    sendPrescriptionReminder,
    processDoctorOverdueAppointments,
    sendCareersApplicationDigest,
    sendInterviewReminder24h,
    sendInterviewReminder30m,
    screenCareersApplication,
  ],
});
