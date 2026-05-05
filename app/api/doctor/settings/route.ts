import { UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  consultationPriceCentsByDurationSchema,
  parsePriceMap,
} from "@/lib/doctor-pricing";
import { SUPPORTED_CURRENCIES, coerceSupportedCurrency } from "@/lib/currency";
import { DOCTOR_SPECIALIZATIONS } from "@/lib/doctor-specializations";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateDoctorSettingsSchema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().max(32).optional(),
  specialization: z.enum(
    DOCTOR_SPECIALIZATIONS as unknown as readonly [string, ...string[]],
    { message: "Please choose a valid specialization." },
  ),
  qualification: z
    .string()
    .min(2, "Qualification is required")
    .max(255)
    .optional(),
  licenseNumber: z.string().min(3).max(255),
  yearsExperience: z.number().int().min(0).max(80).nullable().optional(),
  bio: z.string().max(3000).nullable().optional(),
  profilePhotoUrl: z.string().min(1).max(100_000),
  timezone: z.string().min(1).max(128),
  currency: z.enum(SUPPORTED_CURRENCIES),
  consultationPriceCentsByDuration: consultationPriceCentsByDurationSchema,
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
      phone: true,
      specialization: true,
      qualification: true,
      licenseNumber: true,
      yearsExperience: true,
      bio: true,
      profilePhotoUrl: true,
      timezone: true,
      currency: true,
      consultationPriceCentsByDuration: true,
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
      phone: doctor.phone,
      specialization: doctor.specialization,
      qualification: doctor.qualification,
      licenseNumber: doctor.licenseNumber,
      yearsExperience: doctor.yearsExperience,
      bio: doctor.bio,
      profilePhotoUrl: doctor.profilePhotoUrl,
      timezone: doctor.timezone,
      currency: coerceSupportedCurrency(doctor.currency),
      consultationPriceCentsByDuration: parsePriceMap(
        doctor.consultationPriceCentsByDuration,
      ),
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
  const phoneRaw = data.phone !== undefined ? data.phone.trim() : undefined;
  let phoneUpdate: string | null | undefined = undefined;
  if (phoneRaw !== undefined) {
    if (phoneRaw.length === 0) {
      phoneUpdate = null;
    } else if (phoneRaw.length < 5) {
      return NextResponse.json(
        { error: "Phone must be at least 5 characters if provided" },
        { status: 400 },
      );
    } else {
      phoneUpdate = phoneRaw;
    }
  }
  const updated = await prisma.doctor.update({
    where: { id: doctor.id },
    data: {
      name: data.name.trim(),
      ...(phoneUpdate !== undefined ? { phone: phoneUpdate } : {}),
      specialization: data.specialization.trim(),
      ...(data.qualification !== undefined
        ? { qualification: data.qualification.trim() || null }
        : {}),
      licenseNumber: data.licenseNumber.trim(),
      yearsExperience: data.yearsExperience ?? null,
      bio: data.bio?.trim() || null,
      profilePhotoUrl: data.profilePhotoUrl.trim(),
      timezone: data.timezone.trim(),
      currency: data.currency,
      consultationPriceCentsByDuration: data.consultationPriceCentsByDuration,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      specialization: true,
      qualification: true,
      licenseNumber: true,
      yearsExperience: true,
      bio: true,
      profilePhotoUrl: true,
      timezone: true,
      currency: true,
      consultationPriceCentsByDuration: true,
    },
  });

  return NextResponse.json({
    ok: true,
    doctor: {
      ...updated,
      currency: coerceSupportedCurrency(updated.currency),
      consultationPriceCentsByDuration: parsePriceMap(
        updated.consultationPriceCentsByDuration,
      ),
    },
  });
}
