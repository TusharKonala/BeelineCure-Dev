import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const appointmentSchema = z.object({
  doctorId: z.string().min(1),
  date: z.string(),
  time: z.string().min(1),
  patientName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  notes: z.string().optional(),
});

function parseDateOnly(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = appointmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const {
    doctorId,
    date: dateParam,
    time,
    patientName,
    email,
    phone,
    notes,
  } = parsed.data;

  const date = parseDateOnly(dateParam);
  if (!date) {
    return NextResponse.json(
      { error: "Invalid date. Use YYYY-MM-DD." },
      { status: 400 },
    );
  }

  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
  });

  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  const existing = await prisma.appointment.findUnique({
    where: {
      doctorId_date_time: { doctorId, date, time },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "This time slot is no longer available" },
      { status: 409 },
    );
  }

  const appointment = await prisma.appointment.create({
    data: {
      doctorId,
      date,
      time,
      patientName,
      email,
      phone,
      notes,
      consultationType: "CLINIC",
    },
  });

  return NextResponse.json(appointment);
}
