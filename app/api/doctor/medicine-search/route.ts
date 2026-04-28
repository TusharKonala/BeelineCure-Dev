import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getLocalMedicineSuggestions,
  normalizeMedicineName,
  type MedicineSuggestion,
} from "@/lib/medicine-catalog";

const MAX_RESULTS = 10;

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

  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
  if (!query) {
    return NextResponse.json({ suggestions: [] as MedicineSuggestion[] });
  }

  const localSuggestions = getLocalMedicineSuggestions(query);
  const customRows = await prisma.customMedicine.findMany({
    where: {
      createdByDoctorId: doctor.id,
      name: {
        contains: query,
        mode: "insensitive",
      },
    },
    orderBy: { createdAt: "desc" },
    select: { name: true },
    take: MAX_RESULTS,
  });

  const seen = new Set<string>();
  const merged: MedicineSuggestion[] = [];
  for (const suggestion of localSuggestions) {
    const key = normalizeMedicineName(suggestion.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push({ name: suggestion.name });
    if (merged.length >= MAX_RESULTS) {
      return NextResponse.json({ suggestions: merged });
    }
  }
  for (const row of customRows) {
    const key = normalizeMedicineName(row.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push({ name: row.name });
    if (merged.length >= MAX_RESULTS) {
      break;
    }
  }

  return NextResponse.json({ suggestions: merged });
}
