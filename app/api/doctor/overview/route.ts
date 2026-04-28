import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { AppointmentStatus, UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { doctorAppointmentDateWhere } from "@/lib/doctor-appointment-filters";
import { prisma } from "@/lib/db";
import { isDoctorTimeInPast } from "@/lib/timezone-display";

type UpcomingAppointmentItem = {
  id: string;
  patientName: string;
  date: string;
  time: string;
  timezone: string;
  durationMinutes: number;
};

type RecentPatientItem = {
  patientName: string;
  email: string;
  phone: string;
  lastAppointmentDate: string;
  lastAppointmentTime: string;
  lastAppointmentTimezone: string;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.DOCTOR) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    select: { id: true, timezone: true },
  });
  if (!doctor) {
    return NextResponse.json(
      { error: "Doctor profile not found" },
      { status: 404 },
    );
  }

  const todayFilter = doctorAppointmentDateWhere("today", doctor.timezone);
  const todayStart = todayFilter?.gte;
  const todayEnd = todayFilter?.lte;

  const [todayAppointments, patientEmails, pendingPrescriptionCandidates, upcomingCandidates, recentPatientCandidates] =
    await Promise.all([
      prisma.appointment.count({
        where: {
          doctorId: doctor.id,
          date: todayFilter,
          status: { not: AppointmentStatus.CANCELLED },
        },
      }),
      prisma.appointment.findMany({
        where: { doctorId: doctor.id },
        distinct: ["email"],
        select: { email: true },
      }),
      prisma.appointment.findMany({
        where: {
          doctorId: doctor.id,
          status: AppointmentStatus.CONFIRMED,
          prescription: { is: null },
          ...(todayEnd ? { date: { lte: todayEnd } } : {}),
        },
        select: {
          date: true,
          time: true,
          timezone: true,
        },
      }),
      prisma.appointment.findMany({
        where: {
          doctorId: doctor.id,
          OR: [
            { status: AppointmentStatus.PENDING },
            {
              status: AppointmentStatus.CONFIRMED,
              ...(todayStart ? { date: { gte: todayStart } } : {}),
            },
          ],
        },
        orderBy: [{ date: "asc" }, { time: "asc" }],
        take: 50,
        select: {
          id: true,
          patientName: true,
          date: true,
          time: true,
          timezone: true,
          durationMinutes: true,
          status: true,
        },
      }),
      prisma.appointment.findMany({
        where: {
          doctorId: doctor.id,
          status: { not: AppointmentStatus.CANCELLED },
          ...(todayEnd ? { date: { lte: todayEnd } } : {}),
        },
        orderBy: [{ date: "desc" }, { time: "desc" }],
        take: 100,
        select: {
          patientName: true,
          email: true,
          phone: true,
          date: true,
          time: true,
          timezone: true,
        },
      }),
    ]);

  const totalUniquePatients = new Set(
    patientEmails
      .map((entry) => entry.email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  ).size;

  const pendingPrescriptions = pendingPrescriptionCandidates.filter((item) =>
    isDoctorTimeInPast(
      item.date.toISOString().slice(0, 10),
      item.time,
      item.timezone,
    ),
  ).length;

  const upcomingAppointments: UpcomingAppointmentItem[] = [];
  for (const item of upcomingCandidates) {
    if (item.status === AppointmentStatus.CONFIRMED) {
      const inPast = isDoctorTimeInPast(
        item.date.toISOString().slice(0, 10),
        item.time,
        item.timezone,
      );
      if (inPast) continue;
    }

    upcomingAppointments.push({
      id: item.id,
      patientName: item.patientName,
      date: item.date.toISOString().slice(0, 10),
      time: item.time,
      timezone: item.timezone,
      durationMinutes: item.durationMinutes,
    });
    if (upcomingAppointments.length >= 3) break;
  }

  const seenPatientEmails = new Set<string>();
  const recentPatients: RecentPatientItem[] = [];
  for (const item of recentPatientCandidates) {
    const inPast = isDoctorTimeInPast(
      item.date.toISOString().slice(0, 10),
      item.time,
      item.timezone,
    );
    if (!inPast) continue;

    const normalizedEmail = item.email.trim().toLowerCase();
    if (!normalizedEmail || seenPatientEmails.has(normalizedEmail)) continue;
    seenPatientEmails.add(normalizedEmail);

    recentPatients.push({
      patientName: item.patientName,
      email: item.email.trim(),
      phone: item.phone,
      lastAppointmentDate: item.date.toISOString().slice(0, 10),
      lastAppointmentTime: item.time,
      lastAppointmentTimezone: item.timezone,
    });

    if (recentPatients.length >= 3) break;
  }

  return NextResponse.json({
    stats: {
      todayAppointments,
      totalUniquePatients,
      pendingPrescriptions,
    },
    upcomingAppointments,
    recentPatients,
  });
}
