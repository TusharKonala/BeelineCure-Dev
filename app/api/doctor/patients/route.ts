import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { UserRole, type Prisma } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { mergeDoctorPatientSearch } from "@/lib/doctor-appointment-filters";
import { prisma } from "@/lib/db";

type PatientAggregate = {
  patientName: string;
  email: string;
  phone: string;
  appointmentCount: number;
  prescriptionCount: number;
  lastAppointmentDate: string;
  lastAppointmentTime: string;
  lastAppointmentTimezone: string;
  lastAppointmentStatus: string;
};

function isAfterAppointment(
  candidateDate: Date,
  candidateTime: string,
  currentDate: string,
  currentTime: string,
): boolean {
  const candidateDateOnly = candidateDate.toISOString().slice(0, 10);
  if (candidateDateOnly > currentDate) return true;
  if (candidateDateOnly < currentDate) return false;
  return candidateTime > currentTime;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.DOCTOR) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!doctor) {
    return NextResponse.json(
      { error: "Doctor profile not found" },
      { status: 404 },
    );
  }

  const search = (request.nextUrl.searchParams.get("search") ?? "").trim();
  const page = Math.max(
    1,
    Number(request.nextUrl.searchParams.get("page") ?? "1") || 1,
  );
  const limit = Math.min(
    20,
    Math.max(5, Number(request.nextUrl.searchParams.get("limit") ?? "5") || 5),
  );

  const baseWhere: Prisma.AppointmentWhereInput = { doctorId: doctor.id };
  const selectedWhere = mergeDoctorPatientSearch(baseWhere, search);

  const appointments = await prisma.appointment.findMany({
    where: selectedWhere,
    orderBy: [{ date: "desc" }, { time: "desc" }],
    select: {
      patientName: true,
      email: true,
      phone: true,
      date: true,
      time: true,
      timezone: true,
      status: true,
      prescription: {
        select: { appointmentId: true },
      },
    },
  });

  const grouped = new Map<string, PatientAggregate>();

  for (const appointment of appointments) {
    const normalizedEmail = appointment.email.trim().toLowerCase();
    if (!normalizedEmail) continue;

    const dateOnly = appointment.date.toISOString().slice(0, 10);
    const current = grouped.get(normalizedEmail);
    if (!current) {
      grouped.set(normalizedEmail, {
        patientName: appointment.patientName,
        email: appointment.email.trim(),
        phone: appointment.phone,
        appointmentCount: 1,
        prescriptionCount: appointment.prescription ? 1 : 0,
        lastAppointmentDate: dateOnly,
        lastAppointmentTime: appointment.time,
        lastAppointmentTimezone: appointment.timezone,
        lastAppointmentStatus: appointment.status,
      });
      continue;
    }

    current.appointmentCount += 1;
    if (appointment.prescription) current.prescriptionCount += 1;

    if (
      isAfterAppointment(
        appointment.date,
        appointment.time,
        current.lastAppointmentDate,
        current.lastAppointmentTime,
      )
    ) {
      current.patientName = appointment.patientName;
      current.email = appointment.email.trim();
      current.phone = appointment.phone;
      current.lastAppointmentDate = dateOnly;
      current.lastAppointmentTime = appointment.time;
      current.lastAppointmentTimezone = appointment.timezone;
      current.lastAppointmentStatus = appointment.status;
    }
  }

  const items = Array.from(grouped.values()).sort((a, b) => {
    if (a.lastAppointmentDate === b.lastAppointmentDate) {
      return b.lastAppointmentTime.localeCompare(a.lastAppointmentTime);
    }
    return b.lastAppointmentDate.localeCompare(a.lastAppointmentDate);
  });

  const start = (page - 1) * limit;
  const paginatedItems = items.slice(start, start + limit);

  return NextResponse.json({
    items: paginatedItems.map((item) => ({
      ...item,
      hasPrescription: item.prescriptionCount > 0,
    })),
    hasMore: start + limit < items.length,
    total: items.length,
    page,
  });
}
