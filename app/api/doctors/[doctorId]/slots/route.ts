import { prisma } from "@/lib/db";
import { publicDoctorByIdWhere } from "@/lib/doctor-visibility";
import { timeToMinutes } from "@/lib/time";
import { NextRequest, NextResponse } from "next/server";
import { AppointmentStatus } from "@/generated/prisma/client";

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function generateSlots(
  startTime: string,
  endTime: string,
  intervalMinutes: number,
): string[] {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const slots: string[] = [];
  for (let t = start; t + intervalMinutes <= end; t += intervalMinutes) {
    slots.push(minutesToTime(t));
  }
  return slots;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ doctorId: string }> },
) {
  const { doctorId } = await params;
  const dateParam = request.nextUrl.searchParams.get("date");
  const excludeAppointmentId = request.nextUrl.searchParams.get(
    "excludeAppointmentId",
  );

  if (!dateParam) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  const date = new Date(dateParam);

  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  date.setUTCHours(0, 0, 0, 0);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (date < today) {
    return NextResponse.json(
      { error: "Cannot fetch slots for past dates" },
      { status: 400 },
    );
  }

  const [doctor, availabilities, appointments] = await Promise.all([
    prisma.doctor.findFirst({
      where: publicDoctorByIdWhere(doctorId),
      select: { timezone: true },
    }),
    prisma.doctorAvailability.findMany({
      where: { doctorId, date },
    }),
    prisma.appointment.findMany({
      where: {
        doctorId,
        date,
        status: { not: AppointmentStatus.CANCELLED },
        ...(excludeAppointmentId
          ? { id: { not: excludeAppointmentId } }
          : {}),
      },
    }),
  ]);

  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  const slots = availabilities.flatMap((a) =>
    generateSlots(a.startTime, a.endTime, 30),
  );

  const booked = new Set(appointments.map((a) => a.time));

  const available = [...new Set(slots)].filter((s) => !booked.has(s)).sort();

  return NextResponse.json({
    slots: available,
    doctorTimezone: doctor.timezone,
  });
}
