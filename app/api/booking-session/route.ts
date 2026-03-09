import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bookingSessionSchema = z.object({
  doctorId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().min(1),
  consultationType: z.enum(["CLINIC", "ONLINE"]),
  patientName: z.string().min(1),
  email: z.string().email(),
  phone: z
    .string()
    .min(7, "Phone number is too short")
    .max(15, "Phone number is too long")
    .regex(/^[+0-9()\-\\s]+$/, "Invalid phone number"),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bookingSessionSchema.safeParse(body);

  if (!parsed.success) {
    console.log(parsed.error.flatten());
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const { doctorId, date, time, consultationType, patientName, email, phone } =
    parsed.data;

  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
  });

  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const bookingSession = await prisma.bookingSession.create({
    data: {
      doctorId,
      patientName,
      email,
      phone,
      date,
      time,
      consultationType,
      status: "PENDING",
      expiresAt,
    },
  });

  return NextResponse.json({ bookingSessionId: bookingSession.id });
}
