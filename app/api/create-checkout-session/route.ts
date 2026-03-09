import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { BookingSessionStatus } from "@/generated/prisma/client";
import { z } from "zod";

const schema = z.object({
  bookingSessionId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { bookingSessionId } = parsed.data;

    const bookingSession = await prisma.bookingSession.findUnique({
      where: { id: bookingSessionId },
    });

    if (!bookingSession) {
      return NextResponse.json(
        { error: "Booking session not found" },
        { status: 404 },
      );
    }

    if (bookingSession.status !== BookingSessionStatus.PENDING) {
      return NextResponse.json(
        { error: "Booking session is no longer valid" },
        { status: 400 },
      );
    }

    if (bookingSession.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Booking session expired" },
        { status: 400 },
      );
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: bookingSession.doctorId },
    });

    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }

    const headersList = await headers();
    const origin = headersList.get("origin");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: process.env.STRIPE_CONSULTATION_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/book-appointment`,
      metadata: {
        bookingSessionId: bookingSession.id,
        doctorId: bookingSession.doctorId,
        date: bookingSession.date,
        time: bookingSession.time,
        consultationType: bookingSession.consultationType,
        patientName: bookingSession.patientName,
        email: bookingSession.email,
        phone: bookingSession.phone,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "An unknown error occurred" },
      { status: 500 },
    );
  }
}
