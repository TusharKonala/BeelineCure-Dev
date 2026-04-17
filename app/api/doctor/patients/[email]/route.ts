import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
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

function medicineNamesSummary(medicines: PrescriptionMedicine[]): string | null {
  if (medicines.length === 0) return null;
  const uniqueNames = Array.from(
    new Set(
      medicines
        .map((medicine) => medicine.name.trim())
        .filter((name) => name.length > 0),
    ),
  );
  if (uniqueNames.length === 0) return null;
  const preview = uniqueNames.slice(0, 3).join(", ");
  if (uniqueNames.length <= 3) return preview;
  return `${preview}, +${uniqueNames.length - 3} more`;
}

type RouteContext = {
  params: Promise<{ email: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
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
    return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });
  }

  const { email: emailParam } = await context.params;
  const decodedEmail = decodeURIComponent(emailParam ?? "").trim();
  if (!decodedEmail) {
    return NextResponse.json({ error: "Patient email is required" }, { status: 400 });
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId: doctor.id,
      email: { equals: decodedEmail, mode: "insensitive" },
    },
    orderBy: [{ date: "desc" }, { time: "desc" }],
    select: {
      id: true,
      patientName: true,
      email: true,
      phone: true,
      date: true,
      time: true,
      timezone: true,
      consultationType: true,
      status: true,
      notes: true,
      prescription: {
        select: {
          medicines: true,
          generalNotes: true,
        },
      },
    },
  });

  if (appointments.length === 0) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const latestAppointment = appointments[0];
  const prescriptionAppointment = appointments.find((appointment) => {
    const medicinesRaw = appointment.prescription?.medicines;
    if (!Array.isArray(medicinesRaw)) return false;
    return medicinesRaw.some(isPrescriptionMedicine);
  });

  const userWithHealthProfile = await prisma.user.findFirst({
    where: {
      email: { equals: decodedEmail, mode: "insensitive" },
    },
    select: {
      healthProfile: {
        select: {
          id: true,
          bloodGroup: true,
          heightCm: true,
          weightKg: true,
          dateOfBirth: true,
          gender: true,
          allergies: true,
          conditions: true,
          currentMedications: true,
          pastSurgeries: true,
          smokingStatus: true,
          alcoholUse: true,
          activityLevel: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
          emergencyContactRelationship: true,
          emergencyContact2Name: true,
          emergencyContact2Phone: true,
          emergencyContact2Relationship: true,
        },
      },
    },
  });

  let lastPrescription: {
    appointmentId: string;
    date: string;
    time: string;
    timezone: string;
    consultationType: string;
    medicinesCount: number;
    medicinesSummary: string | null;
    generalNotes: string | null;
  } | null = null;

  if (prescriptionAppointment?.prescription) {
    const medicinesRaw = prescriptionAppointment.prescription.medicines;
    const medicines = Array.isArray(medicinesRaw) ? medicinesRaw.filter(isPrescriptionMedicine) : [];
    if (medicines.length > 0) {
      lastPrescription = {
        appointmentId: prescriptionAppointment.id,
        date: prescriptionAppointment.date.toISOString().slice(0, 10),
        time: prescriptionAppointment.time,
        timezone: prescriptionAppointment.timezone,
        consultationType: prescriptionAppointment.consultationType,
        medicinesCount: medicines.length,
        medicinesSummary: medicineNamesSummary(medicines),
        generalNotes: prescriptionAppointment.prescription.generalNotes,
      };
    }
  }

  return NextResponse.json({
    patient: {
      patientName: latestAppointment.patientName,
      email: latestAppointment.email,
      phone: latestAppointment.phone,
      appointmentCount: appointments.length,
    },
    healthProfile: userWithHealthProfile?.healthProfile ?? null,
    lastAppointment: latestAppointment
      ? {
          id: latestAppointment.id,
          date: latestAppointment.date.toISOString().slice(0, 10),
          time: latestAppointment.time,
          timezone: latestAppointment.timezone,
          consultationType: latestAppointment.consultationType,
          status: latestAppointment.status,
          notes: latestAppointment.notes,
        }
      : null,
    lastPrescription,
  });
}
