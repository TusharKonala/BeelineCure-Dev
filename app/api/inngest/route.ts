import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  chatPushAfter5m,
  doctorUnreadChatDigest,
  ensureChatConversationJob,
  lockChatAfter48h,
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
    ensureChatConversationJob,
    lockChatAfter48h,
    chatPushAfter5m,
    doctorUnreadChatDigest,
  ],
});
