import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  processDoctorOverdueAppointments,
  sendAppointmentReminder,
  sendCareersApplicationDigest,
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
  ],
});
