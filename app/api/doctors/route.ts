import { NextRequest, NextResponse } from "next/server";
import {
  AvailabilityConsultationType,
  type Prisma,
} from "@/generated/prisma/client";
import {
  isSupportedCurrency,
  coerceSupportedCurrency,
  type SupportedCurrency,
} from "@/lib/currency";
import { prisma } from "@/lib/db";
import {
  ALLOWED_SLOT_DURATION_MINUTES,
  type AllowedSlotDurationMinutes,
} from "@/lib/doctor-availability-slots";
import {
  parsePriceMap,
  priceCentsForDuration,
} from "@/lib/doctor-pricing";
import { isDoctorSpecialization } from "@/lib/doctor-specializations";
import { publicDoctorWhere } from "@/lib/doctor-visibility";
import { convertCentsAmount } from "@/lib/fx-rates";

const DEFAULT_PAGE_SIZE = 6;
const MAX_PAGE_SIZE = 50;

/** Public listing: pagination + specialty, consultation mode, and duration-aware fee filter. */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(sp.get("limit") ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE),
  );
  const specialtyRaw = (sp.get("specialty") ?? "").trim();
  const patientCurrencyRaw = (sp.get("patientCurrency") ?? "USD")
    .trim()
    .toUpperCase();
  const rawFeeDuration = Number(sp.get("feeDurationMinutes") ?? "30");

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
  if (!isSupportedCurrency(patientCurrencyRaw)) {
    return NextResponse.json(
      { error: "Invalid patientCurrency parameter." },
      { status: 400 },
    );
  }
  const patientCurrency: SupportedCurrency = patientCurrencyRaw;
  const feeDurationMinutes: AllowedSlotDurationMinutes =
    ALLOWED_SLOT_DURATION_MINUTES.includes(
      rawFeeDuration as AllowedSlotDurationMinutes,
    )
      ? (rawFeeDuration as AllowedSlotDurationMinutes)
      : 30;

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
      { error: "Max amount can't be smaller than min amount." },
      { status: 400 },
    );
  }

  const andWhere: Prisma.DoctorWhereInput[] = [publicDoctorWhere];
  if (specialty) {
    andWhere.push({ specialization: specialty });
  }
  if (consultationMode === "online") {
    andWhere.push({
      availabilities: {
        some: {
          consultationType: {
            in: [
              AvailabilityConsultationType.ONLINE,
              AvailabilityConsultationType.BOTH,
            ],
          },
        },
      },
    });
  } else if (consultationMode === "clinic") {
    andWhere.push({
      availabilities: {
        some: {
          consultationType: {
            in: [
              AvailabilityConsultationType.CLINIC,
              AvailabilityConsultationType.BOTH,
            ],
          },
        },
      },
    });
  }

  const doctors = await prisma.doctor.findMany({
    where: { AND: andWhere },
    select: {
      id: true,
      name: true,
      specialization: true,
      qualification: true,
      profilePhotoUrl: true,
      slug: true,
      currency: true,
      consultationPriceCentsByDuration: true,
    },
    orderBy: { name: "asc" },
  });

  let filteredDoctors = doctors;
  if (feeMinCents != null || feeMaxCents != null) {
    try {
      const withPatientCurrencyFee = await Promise.all(
        doctors.map(async (doctor) => {
          const priceMap = parsePriceMap(doctor.consultationPriceCentsByDuration);
          const doctorFeeCents = priceCentsForDuration(
            priceMap,
            feeDurationMinutes,
          );
          const doctorCurrency = coerceSupportedCurrency(doctor.currency);
          const minInDoctorCurrency =
            feeMinCents == null
              ? null
              : await convertCentsAmount(
                  feeMinCents,
                  patientCurrency,
                  doctorCurrency,
                );
          const maxInDoctorCurrency =
            feeMaxCents == null
              ? null
              : await convertCentsAmount(
                  feeMaxCents,
                  patientCurrency,
                  doctorCurrency,
                );
          return { doctor, doctorFeeCents, minInDoctorCurrency, maxInDoctorCurrency };
        }),
      );
      filteredDoctors = withPatientCurrencyFee
        .filter(({ doctorFeeCents, minInDoctorCurrency, maxInDoctorCurrency }) => {
          if (
            minInDoctorCurrency != null &&
            doctorFeeCents < minInDoctorCurrency
          ) {
            return false;
          }
          if (
            maxInDoctorCurrency != null &&
            doctorFeeCents > maxInDoctorCurrency
          ) {
            return false;
          }
          return true;
        })
        .map(({ doctor }) => doctor);
    } catch {
      return NextResponse.json(
        { error: "Unable to convert doctor fees right now." },
        { status: 503 },
      );
    }
  }

  const skip = (page - 1) * limit;
  const pagedDoctors = filteredDoctors.slice(skip, skip + limit);

  return NextResponse.json({
    items: pagedDoctors.map((doctor) => ({
      id: doctor.id,
      name: doctor.name,
      specialization: doctor.specialization,
      qualification: doctor.qualification,
      profilePhotoUrl: doctor.profilePhotoUrl,
      slug: doctor.slug,
    })),
    page,
    limit,
    hasMore: skip + limit < filteredDoctors.length,
  });
}
