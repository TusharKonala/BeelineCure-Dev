import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import {
  AppointmentStatus,
  type Prisma,
  UserRole,
} from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { inngest } from "@/inngest/client";
import { prescriptionReminderTsFromSavedAt } from "@/lib/reminder-time";

type MedicinePayload = {
  name: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string;
};

function sanitizeMedicines(input: unknown): MedicinePayload[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const medicines: MedicinePayload[] = [];
  for (const row of input) {
    if (!row || typeof row !== "object") return null;
    const candidate = row as Record<string, unknown>;
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const dosage = typeof candidate.dosage === "string" ? candidate.dosage.trim() : "";
    const frequency =
      typeof candidate.frequency === "string" ? candidate.frequency.trim() : "";
    const instructions =
      typeof candidate.instructions === "string" ? candidate.instructions.trim() : "";
    const durationRaw = candidate.durationDays;
    const durationDays =
      typeof durationRaw === "number" ? durationRaw : Number(durationRaw);
    if (
      !name ||
      !dosage ||
      !frequency ||
      !instructions ||
      !Number.isInteger(durationDays) ||
      durationDays <= 0
    ) {
      return null;
    }
    medicines.push({
      name,
      dosage,
      frequency,
      durationDays,
      instructions,
    });
  }
  return medicines;
}

async function getDoctorFromSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== UserRole.DOCTOR) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!doctor) {
    return { error: NextResponse.json({ error: "Doctor profile not found" }, { status: 404 }) };
  }
  return { doctor };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ appointmentId: string }> },
) {
  const doctorResult = await getDoctorFromSession();
  if ("error" in doctorResult) return doctorResult.error;

  const { appointmentId } = await context.params;
  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      doctorId: doctorResult.doctor.id,
    },
    select: {
      id: true,
      patientName: true,
      date: true,
      time: true,
      timezone: true,
      status: true,
      prescription: {
        select: {
          medicines: true,
          generalNotes: true,
        },
      },
    },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  return NextResponse.json({
    appointment: {
      id: appointment.id,
      patientName: appointment.patientName,
      date: appointment.date.toISOString().slice(0, 10),
      time: appointment.time,
      timezone: appointment.timezone,
      status: appointment.status,
    },
    prescription: appointment.prescription
      ? {
          medicines: appointment.prescription.medicines,
          generalNotes: appointment.prescription.generalNotes,
        }
      : null,
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ appointmentId: string }> },
) {
  const doctorResult = await getDoctorFromSession();
  if ("error" in doctorResult) return doctorResult.error;

  const { appointmentId } = await context.params;
  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      doctorId: doctorResult.doctor.id,
    },
    select: {
      id: true,
      status: true,
      patientTimezone: true,
    },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }
  if (appointment.status === AppointmentStatus.CANCELLED) {
    return NextResponse.json({ error: "Cancelled appointment cannot be prescribed" }, { status: 409 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        medicines?: unknown;
        generalNotes?: unknown;
      }
    | null;

  const medicines = sanitizeMedicines(body?.medicines);
  if (!medicines) {
    return NextResponse.json(
      { error: "Invalid medicines. Provide at least one valid medicine entry." },
      { status: 400 },
    );
  }

  const generalNotes =
    typeof body?.generalNotes === "string" ? body.generalNotes.trim() : "";

  await prisma.$transaction(async (tx) => {
    await tx.prescription.upsert({
      where: { appointmentId: appointment.id },
      create: {
        appointmentId: appointment.id,
        medicines: medicines as Prisma.InputJsonValue,
        generalNotes: generalNotes || null,
      },
      update: {
        medicines: medicines as Prisma.InputJsonValue,
        generalNotes: generalNotes || null,
      },
    });

    await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        status: AppointmentStatus.COMPLETED,
      },
    });
  });

  const courseDays = Math.max(...medicines.map((medicine) => medicine.durationDays));
  try {
    const { halfwayTs, completedTs } = prescriptionReminderTsFromSavedAt(
      new Date(),
      appointment.patientTimezone,
      courseDays,
    );

    if (halfwayTs !== null) {
      await inngest.send({
        name: "prescription/reminder.scheduled",
        data: {
          appointmentId: appointment.id,
          reminderType: "HALFWAY",
        },
        ts: halfwayTs,
      });
    }
    if (completedTs !== null) {
      await inngest.send({
        name: "prescription/reminder.scheduled",
        data: {
          appointmentId: appointment.id,
          reminderType: "COMPLETED",
        },
        ts: completedTs,
      });
    }
  } catch (err) {
    console.error("[doctor-prescription] Failed to schedule reminders:", err);
  }

  return NextResponse.json({ ok: true });
}
