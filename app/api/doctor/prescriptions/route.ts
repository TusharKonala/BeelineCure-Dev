import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import {
  AppointmentStatus,
  type Prisma,
  UserRole,
} from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import {
  doctorAppointmentDateTimeOrderBy,
  doctorAppointmentDateWhere,
  mergeDoctorPatientSearch,
  normalizeDoctorDateFilter,
} from "@/lib/doctor-appointment-filters";
import { prisma } from "@/lib/db";

type PrescriptionMedicine = {
  name: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string;
};

function isPrescriptionMedicine(value: unknown): value is PrescriptionMedicine {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.dosage === "string" &&
    typeof candidate.frequency === "string" &&
    typeof candidate.instructions === "string" &&
    typeof candidate.durationDays === "number" &&
    Number.isFinite(candidate.durationDays)
  );
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
    select: { id: true, timezone: true },
  });
  if (!doctor) {
    return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });
  }

  const search = (request.nextUrl.searchParams.get("search") ?? "").trim();
  const dateFilter = normalizeDoctorDateFilter(request.nextUrl.searchParams.get("dateFilter"));
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(20, Math.max(5, Number(request.nextUrl.searchParams.get("limit") ?? "5") || 5));

  const baseWhere: Prisma.AppointmentWhereInput = {
    doctorId: doctor.id,
    status: AppointmentStatus.COMPLETED,
    prescription: { isNot: null },
  };

  const dateWhere = doctorAppointmentDateWhere(dateFilter, doctor.timezone);
  if (dateWhere) {
    baseWhere.date = dateWhere;
  }

  const selectedWhere = mergeDoctorPatientSearch(baseWhere, search);

  const appointments = await prisma.appointment.findMany({
    where: selectedWhere,
    orderBy: doctorAppointmentDateTimeOrderBy(dateFilter),
    select: {
      id: true,
      patientName: true,
      email: true,
      phone: true,
      date: true,
      time: true,
      timezone: true,
      consultationType: true,
      prescription: {
        select: {
          medicines: true,
          generalNotes: true,
        },
      },
    },
  });

  const items = appointments
    .map((appointment) => {
      const medicinesRaw = appointment.prescription?.medicines;
      const medicines = Array.isArray(medicinesRaw)
        ? medicinesRaw.filter(isPrescriptionMedicine)
        : [];
      if (medicines.length === 0) {
        return null;
      }

      return {
        appointmentId: appointment.id,
        patientName: appointment.patientName,
        email: appointment.email,
        phone: appointment.phone,
        date: appointment.date.toISOString().slice(0, 10),
        time: appointment.time,
        timezone: appointment.timezone,
        consultationType: appointment.consultationType,
        medicines,
        generalNotes: appointment.prescription?.generalNotes ?? null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const start = (page - 1) * limit;
  const paginatedItems = items.slice(start, start + limit);

  return NextResponse.json({
    items: paginatedItems,
    hasMore: start + limit < items.length,
    total: items.length,
    page,
  });
}
