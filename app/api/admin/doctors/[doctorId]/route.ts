import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { AppointmentStatus, UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cancelAppointmentByDoctor } from "@/lib/doctor-cancellations";
import { isDoctorTimeInPast } from "@/lib/timezone-display";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ doctorId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { doctorId } = await context.params;
  if (!doctorId) {
    return NextResponse.json({ error: "Invalid doctor id" }, { status: 400 });
  }

  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { id: true, isActive: true },
  });
  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  if (!doctor.isActive) {
    return NextResponse.json({
      ok: true,
      alreadyInactive: true,
      cancelledAppointments: 0,
    });
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId: doctor.id,
      status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
    },
    select: {
      id: true,
      date: true,
      time: true,
      timezone: true,
    },
  });

  const futureAppointments = appointments.filter((appointment) => {
    const dateStr = appointment.date.toISOString().slice(0, 10);
    return !isDoctorTimeInPast(dateStr, appointment.time, appointment.timezone);
  });

  let cancelledAppointments = 0;
  for (const appointment of futureAppointments) {
    const result = await cancelAppointmentByDoctor({
      appointmentId: appointment.id,
      doctorId: doctor.id,
      reason: "doctor_unavailable",
      requestOrigin: request.nextUrl.origin,
    });

    if (result.ok) {
      cancelledAppointments += 1;
      continue;
    }
    if (result.code === "ALREADY_CANCELLED" || result.code === "COMPLETED") {
      continue;
    }
    return NextResponse.json(
      {
        error:
          "Failed to cancel one or more future appointments while deactivating doctor.",
      },
      { status: 500 },
    );
  }

  await prisma.doctor.update({
    where: { id: doctor.id },
    data: {
      isActive: false,
      deactivatedAt: new Date(),
      deactivatedByUserId: session.user.id,
    },
  });

  return NextResponse.json({
    ok: true,
    alreadyInactive: false,
    cancelledAppointments,
  });
}
