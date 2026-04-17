import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  processDoctorOverdueAppointments,
  sendAppointmentReminder,
  sendPrescriptionReminder,
} from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sendAppointmentReminder,
    sendPrescriptionReminder,
    processDoctorOverdueAppointments,
  ],
});
