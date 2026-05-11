import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_CONSULTATION_PRICE_CENTS_BY_DURATION } from "@/lib/doctor-pricing";
import { isDoctorSpecialization } from "@/lib/doctor-specializations";

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;

/** Public listing: pagination + specialty, consultation mode, 30‑min fee (JSON). */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(sp.get("limit") ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE),
  );
  const specialtyRaw = (sp.get("specialty") ?? "").trim();

  let specialty: string | null = null;
  if (specialtyRaw.length > 0) {
    if (!isDoctorSpecialization(specialtyRaw)) {
      return NextResponse.json(
        { error: "Invalid specialty parameter." },
        { status: 400 },
      );
    }
    specialty = specialtyRaw;
  }

  const modeRaw = (sp.get("consultationMode") ?? "").trim().toLowerCase();
  let consultationMode: "online" | "clinic" | null = null;
  if (modeRaw === "online" || modeRaw === "clinic") {
    consultationMode = modeRaw;
  } else if (modeRaw.length > 0) {
    return NextResponse.json(
      { error: "consultationMode must be online or clinic." },
      { status: 400 },
    );
  }

  let feeMinCents: number | null = null;
  let feeMaxCents: number | null = null;
  const rawMin = sp.get("feeMinCents");
  const rawMax = sp.get("feeMaxCents");
  if (rawMin != null && rawMin !== "") {
    const n = Number(rawMin);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return NextResponse.json(
        { error: "feeMinCents must be a non-negative integer." },
        { status: 400 },
      );
    }
    feeMinCents = n;
  }
  if (rawMax != null && rawMax !== "") {
    const n = Number(rawMax);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return NextResponse.json(
        { error: "feeMaxCents must be a non-negative integer." },
        { status: 400 },
      );
    }
    feeMaxCents = n;
  }
  if (
    feeMinCents != null &&
    feeMaxCents != null &&
    feeMinCents > feeMaxCents
  ) {
    return NextResponse.json(
      { error: "feeMinCents cannot exceed feeMaxCents." },
      { status: 400 },
    );
  }

  const skip = (page - 1) * limit;
  const take = limit + 1;

  const default30 = DEFAULT_CONSULTATION_PRICE_CENTS_BY_DURATION["30"];

  const extraConditions: Prisma.Sql[] = [];
  if (specialty) {
    extraConditions.push(Prisma.sql`d."specialization" = ${specialty}`);
  }
  if (consultationMode === "online") {
    extraConditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "DoctorAvailability" da
      WHERE da."doctorId" = d.id
        AND da."consultationType" IN (
          'ONLINE'::"AvailabilityConsultationType",
          'BOTH'::"AvailabilityConsultationType"
        )
    )`);
  } else if (consultationMode === "clinic") {
    extraConditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "DoctorAvailability" da
      WHERE da."doctorId" = d.id
        AND da."consultationType" IN (
          'CLINIC'::"AvailabilityConsultationType",
          'BOTH'::"AvailabilityConsultationType"
        )
    )`);
  }
  if (feeMinCents != null) {
    extraConditions.push(Prisma.sql`COALESCE(
      (d."consultationPriceCentsByDuration"->>'30')::int,
      ${default30}
    ) >= ${feeMinCents}`);
  }
  if (feeMaxCents != null) {
    extraConditions.push(Prisma.sql`COALESCE(
      (d."consultationPriceCentsByDuration"->>'30')::int,
      ${default30}
    ) <= ${feeMaxCents}`);
  }

  const extraSql =
    extraConditions.length > 0
      ? Prisma.sql` AND ${Prisma.join(extraConditions, " AND ")}`
      : Prisma.empty;

  const idRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT d.id
    FROM "Doctor" d
    WHERE d."isActive" = true
      AND (
        d."userId" IS NULL
        OR d."approvalStatus" = 'APPROVED'::"DoctorApprovalStatus"
      )
      ${extraSql}
    ORDER BY d.name ASC
    OFFSET ${skip}
    LIMIT ${take}
  `);

  const hasMore = idRows.length > limit;
  const pageIds = idRows.slice(0, limit).map((r) => r.id);

  if (pageIds.length === 0) {
    return NextResponse.json({
      items: [],
      page,
      limit,
      hasMore: false,
    });
  }

  const doctors = await prisma.doctor.findMany({
    where: { id: { in: pageIds } },
    select: {
      id: true,
      name: true,
      specialization: true,
      profilePhotoUrl: true,
      slug: true,
    },
    orderBy: { name: "asc" },
  });

  const byId = new Map(doctors.map((d) => [d.id, d]));
  const items = pageIds
    .map((id) => byId.get(id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  return NextResponse.json({
    items,
    page,
    limit,
    hasMore,
  });
}
