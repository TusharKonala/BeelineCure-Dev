import { prisma } from "@/lib/db";
import { publicDoctorByIdWhere } from "@/lib/doctor-visibility";
import {
  coerceAllowedSlotDurationMinutes,
  expandAvailabilityRowsDetailed,
  inferSlotDurationMinutesFromRows,
} from "@/lib/doctor-availability-slots";
import { NextRequest, NextResponse } from "next/server";
import { AppointmentStatus } from "@/generated/prisma/client";

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
      select: { timezone: true, slotDurationMinutes: true },
    }),
    prisma.doctorAvailability.findMany({
      where: { doctorId, date },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        slotDurationMinutes: true,
        consultationType: true,
      },
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

  const fallback = coerceAllowedSlotDurationMinutes(doctor.slotDurationMinutes);
  const rows = availabilities.map((a) => ({
    id: a.id,
    startTime: a.startTime,
    endTime: a.endTime,
    slotDurationMinutes: a.slotDurationMinutes,
    consultationType: a.consultationType,
  }));
  const slotDetails = expandAvailabilityRowsDetailed(rows, fallback);
  const slots = slotDetails.map((slot) => slot.startTime);
  const slotDurationMinutes = inferSlotDurationMinutesFromRows(rows, fallback);

  const booked = new Set(appointments.map((a) => a.time));

  const available = [...new Set(slots)].filter((s) => !booked.has(s)).sort();
  const availableDetails = slotDetails.filter((detail) =>
    available.includes(detail.startTime),
  );

  return NextResponse.json({
    slots: available,
    slotDetails: availableDetails,
    doctorTimezone: doctor.timezone,
    slotDurationMinutes,
  });
}
