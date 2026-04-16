import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  sendAppointmentReminder,
  sendPrescriptionPatientNotification,
  sendPrescriptionReminder,
} from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sendAppointmentReminder,
    sendPrescriptionReminder,
    sendPrescriptionPatientNotification,
  ],
});
