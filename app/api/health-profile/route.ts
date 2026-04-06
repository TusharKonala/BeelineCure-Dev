import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

function emptyToNull(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function parseOptionalPositiveFloat(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseDateOnlyInput(v: unknown): Date | null {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const healthProfileBodySchema = z.object({
  bloodGroup: z.string().max(32).optional().nullable(),
  heightCm: z.any().optional(),
  weightKg: z.any().optional(),
  dateOfBirth: z.any().optional(),
  gender: z.string().max(64).optional().nullable(),
  allergies: z.string().max(10000).optional().nullable(),
  conditions: z.string().max(10000).optional().nullable(),
  currentMedications: z.string().max(10000).optional().nullable(),
  pastSurgeries: z.string().max(10000).optional().nullable(),
  smokingStatus: z.string().max(64).optional().nullable(),
  alcoholUse: z.string().max(64).optional().nullable(),
  activityLevel: z.string().max(64).optional().nullable(),
  emergencyContactName: z.string().max(200).optional().nullable(),
  emergencyContactPhone: z.string().max(40).optional().nullable(),
  emergencyContactRelationship: z.string().max(120).optional().nullable(),
  emergencyContact2Name: z.string().max(200).optional().nullable(),
  emergencyContact2Phone: z.string().max(40).optional().nullable(),
  emergencyContact2Relationship: z.string().max(120).optional().nullable(),
});

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = healthProfileBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const data = {
    bloodGroup: emptyToNull(parsed.data.bloodGroup ?? null),
    heightCm: parseOptionalPositiveFloat(parsed.data.heightCm),
    weightKg: parseOptionalPositiveFloat(parsed.data.weightKg),
    dateOfBirth: parseDateOnlyInput(parsed.data.dateOfBirth),
    gender: emptyToNull(parsed.data.gender ?? null),
    allergies: emptyToNull(parsed.data.allergies ?? null),
    conditions: emptyToNull(parsed.data.conditions ?? null),
    currentMedications: emptyToNull(parsed.data.currentMedications ?? null),
    pastSurgeries: emptyToNull(parsed.data.pastSurgeries ?? null),
    smokingStatus: emptyToNull(parsed.data.smokingStatus ?? null),
    alcoholUse: emptyToNull(parsed.data.alcoholUse ?? null),
    activityLevel: emptyToNull(parsed.data.activityLevel ?? null),
    emergencyContactName: emptyToNull(parsed.data.emergencyContactName ?? null),
    emergencyContactPhone: emptyToNull(parsed.data.emergencyContactPhone ?? null),
    emergencyContactRelationship: emptyToNull(
      parsed.data.emergencyContactRelationship ?? null,
    ),
    emergencyContact2Name: emptyToNull(parsed.data.emergencyContact2Name ?? null),
    emergencyContact2Phone: emptyToNull(parsed.data.emergencyContact2Phone ?? null),
    emergencyContact2Relationship: emptyToNull(
      parsed.data.emergencyContact2Relationship ?? null,
    ),
  };

  const profile = await prisma.healthProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  return NextResponse.json({ profile });
}
