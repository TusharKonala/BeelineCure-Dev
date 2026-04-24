import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { publicDoctorByIdWhere } from "@/lib/doctor-visibility";
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

    const isExpired =
      bookingSession.status === BookingSessionStatus.EXPIRED ||
      bookingSession.expiresAt < new Date();

    if (isExpired) {
      return NextResponse.json(
        {
          error:
            "This booking session expired after 10 minutes. Please start a new booking.",
          code: "BOOKING_SESSION_EXPIRED",
          doctorId: bookingSession.doctorId,
        },
        { status: 400 },
      );
    }

    if (bookingSession.status !== BookingSessionStatus.PENDING) {
      return NextResponse.json(
        { error: "Booking session is no longer valid" },
        { status: 400 },
      );
    }
    if (bookingSession.consultationType !== "ONLINE") {
      return NextResponse.json(
        { error: "Only online booking sessions can proceed to payment" },
        { status: 409 },
      );
    }

    const doctor = await prisma.doctor.findFirst({
      where: publicDoctorByIdWhere(bookingSession.doctorId),
    });

    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }

    const headersList = await headers();
    const origin = headersList.get("origin");
    const unitAmountCents = doctor.consultationPriceCents ?? 3000;
    const doctorName = doctor.name?.trim() || "your doctor";
    const description = `A secure ${bookingSession.durationMinutes} min online consultation with ${doctorName}.`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: unitAmountCents,
            product_data: {
              name: `Online consultation with ${doctorName}`,
              description,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&notify=1`,
      cancel_url: `${origin}/book-appointment`,
      metadata: {
        bookingSessionId: bookingSession.id,
        doctorId: bookingSession.doctorId,
        date: bookingSession.date,
        time: bookingSession.time,
        durationMinutes: String(bookingSession.durationMinutes),
        consultationPriceCents: String(unitAmountCents),
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
