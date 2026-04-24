import { UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateDoctorSettingsSchema = z.object({
  name: z.string().min(1).max(255),
  specialization: z.string().min(2).max(255),
  licenseNumber: z.string().min(3).max(255),
  yearsExperience: z.number().int().min(0).max(80).nullable().optional(),
  bio: z.string().max(3000).nullable().optional(),
  profilePhotoUrl: z.string().min(1).max(100_000),
  timezone: z.string().min(1).max(128),
  consultationPriceCents: z.number().int().min(100).max(2_000_000),
});

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
    select: {
      id: true,
      name: true,
      specialization: true,
      licenseNumber: true,
      yearsExperience: true,
      bio: true,
      profilePhotoUrl: true,
      timezone: true,
      consultationPriceCents: true,
      googleCalendarRefreshToken: true,
    },
  });

  if (!doctor) {
    return NextResponse.json(
      { error: "Doctor profile not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    doctor: {
      id: doctor.id,
      name: doctor.name,
      specialization: doctor.specialization,
      licenseNumber: doctor.licenseNumber,
      yearsExperience: doctor.yearsExperience,
      bio: doctor.bio,
      profilePhotoUrl: doctor.profilePhotoUrl,
      timezone: doctor.timezone,
      consultationPriceCents: doctor.consultationPriceCents,
    },
    googleCalendarConnected: Boolean(doctor.googleCalendarRefreshToken),
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.DOCTOR) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = updateDoctorSettingsSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
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

  const data = parsed.data;
  const updated = await prisma.doctor.update({
    where: { id: doctor.id },
    data: {
      name: data.name.trim(),
      specialization: data.specialization.trim(),
      licenseNumber: data.licenseNumber.trim(),
      yearsExperience: data.yearsExperience ?? null,
      bio: data.bio?.trim() || null,
      profilePhotoUrl: data.profilePhotoUrl.trim(),
      timezone: data.timezone.trim(),
      consultationPriceCents: data.consultationPriceCents,
    },
    select: {
      id: true,
      name: true,
      specialization: true,
      licenseNumber: true,
      yearsExperience: true,
      bio: true,
      profilePhotoUrl: true,
      timezone: true,
      consultationPriceCents: true,
    },
  });

  return NextResponse.json({ ok: true, doctor: updated });
}
