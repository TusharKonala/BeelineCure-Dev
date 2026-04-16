import { serve } from "inngest/next";
import { NextRequest } from "next/server";
import { inngest } from "@/inngest/client";
import {
  sendAppointmentReminder,
  sendPrescriptionPatientNotification,
  sendPrescriptionReminder,
} from "@/inngest/functions";

const handlers = serve({
  client: inngest,
  functions: [
    sendAppointmentReminder,
    sendPrescriptionReminder,
    sendPrescriptionPatientNotification,
  ],
});

console.info("[prescription-debug] inngest route module loaded", {
  registeredFunctions: [
    "send-appointment-reminder",
    "send-prescription-reminder",
    "send-prescription-patient-notification",
  ],
});

export async function GET(
  request: NextRequest,
  context: Parameters<typeof handlers.GET>[1],
) {
  console.info("[prescription-debug] inngest route GET", {
    url: request.nextUrl.pathname,
  });
  return handlers.GET(request, context);
}

export async function POST(
  request: NextRequest,
  context: Parameters<typeof handlers.POST>[1],
) {
  console.info("[prescription-debug] inngest route POST", {
    url: request.nextUrl.pathname,
    fnId: request.nextUrl.searchParams.get("fnId"),
    stepId: request.nextUrl.searchParams.get("stepId"),
  });
  return handlers.POST(request, context);
}

export async function PUT(
  request: NextRequest,
  context: Parameters<typeof handlers.PUT>[1],
) {
  console.info("[prescription-debug] inngest route PUT", {
    url: request.nextUrl.pathname,
  });
  return handlers.PUT(request, context);
}
