import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";
import { headers } from "next/headers";
import {
  BookingSessionStatus,
  AppointmentStatus,
  PaymentStatus,
  ConsultationType,
} from "@/generated/prisma/client";
import { EmailTemplate } from "@/components/email-template";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function parseDateOnly(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export async function POST(request: NextRequest) {
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return new NextResponse("Webhook signature missing", { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata ?? {};

    const bookingSessionId = metadata.bookingSessionId;

    if (!bookingSessionId) {
      // Nothing to do if we cannot associate to a booking session
      return new NextResponse("OK", { status: 200 });
    }

    const bookingSession = await prisma.bookingSession.findUnique({
      where: { id: bookingSessionId },
    });

    if (!bookingSession) {
      // Ignore if the booking session no longer exists
      return new NextResponse("OK", { status: 200 });
    }

    if (bookingSession.status !== BookingSessionStatus.PENDING) {
      // Already processed or no longer valid – ignore duplicate webhooks
      return new NextResponse("OK", { status: 200 });
    }

    const date = parseDateOnly(bookingSession.date);

    if (!date) {
      console.error(
        "[webhooks] Invalid date on booking session",
        bookingSession.id,
        bookingSession.date,
      );
      return new NextResponse("OK", { status: 200 });
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: bookingSession.doctorId },
    });

    if (!doctor) {
      console.error(
        "[webhooks] Doctor not found for booking session",
        bookingSession.id,
        bookingSession.doctorId,
      );
      return new NextResponse("OK", { status: 200 });
    }

    const cancelToken = randomBytes(32).toString("hex");
    // Create the confirmed appointment from the booking session data
    let appointment;
    try {
      appointment = await prisma.appointment.create({
        data: {
          doctorId: bookingSession.doctorId,
          date,
          time: bookingSession.time,
          patientName: bookingSession.patientName,
          email: bookingSession.email,
          phone: bookingSession.phone,
          notes: bookingSession.notes,
          status: AppointmentStatus.CONFIRMED,
          consultationType:
            bookingSession.consultationType === "ONLINE"
              ? ConsultationType.ONLINE
              : ConsultationType.CLINIC,
          stripePaymentId: session.id,
          paymentStatus: PaymentStatus.PAID,
          cancelToken,
        },
      });
    } catch (err) {
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        // Concurrent webhook or slot taken: prefer idempotent recovery by checkout id
        const existing = await prisma.appointment.findFirst({
          where: { stripePaymentId: session.id },
        });
        if (existing) {
          appointment = existing;
        } else {
          console.error(
            "[webhooks] P2002 creating appointment (slot conflict), bookingSession:",
            bookingSession.id,
          );
          return new NextResponse("OK", { status: 200 });
        }
      } else {
        throw err;
      }
    }

    const sessionAfter = await prisma.bookingSession.findUnique({
      where: { id: bookingSession.id },
    });
    if (sessionAfter?.status === BookingSessionStatus.COMPLETED) {
      return new NextResponse("OK", { status: 200 });
    }

    const headersList = await headers();
    const origin =
      headersList.get("origin") ??
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
      "http://localhost:3000";

    const cancelUrl = `${origin}/cancel?appointmentId=${encodeURIComponent(
      appointment.id,
    )}&token=${encodeURIComponent(appointment.cancelToken!)}`;

    // Mark the booking session as completed to avoid reprocessing
    await prisma.bookingSession.update({
      where: { id: bookingSession.id },
      data: { status: BookingSessionStatus.COMPLETED },
    });

    // Reuse existing confirmation email logic
    try {
      const { error } = await resend.emails.send({
        from: "Clinic Appointments <onboarding@resend.dev>",
        to: appointment.email,
        subject: "Appointment Confirmation",
        react: EmailTemplate({
          doctorName: doctor.name,
          appointmentDate: bookingSession.date,
          appointmentTime: bookingSession.time,
          patientName: bookingSession.patientName,
          consultationType: bookingSession.consultationType as
            | "CLINIC"
            | "ONLINE",
          cancelUrl,
        }),
      });

      if (error) {
        console.error("[webhooks] Confirmation email failed:", error);
      }
    } catch (emailError) {
      console.error("[webhooks] Confirmation email failed:", emailError);
    }
  }

  return new NextResponse("OK", { status: 200 });
}
