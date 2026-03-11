import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { BookingSessionStatus } from "@/generated/prisma/client";
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

    // Create the confirmed appointment from the booking session data
    const appointment = await prisma.appointment.create({
      data: {
        doctorId: bookingSession.doctorId,
        date,
        time: bookingSession.time,
        patientName: bookingSession.patientName,
        email: bookingSession.email,
        phone: bookingSession.phone,
        consultationType: bookingSession.consultationType as
          | "CLINIC"
          | "ONLINE",
        stripePaymentId: session.id,
      },
    });

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
          consultationType: bookingSession.consultationType,
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
