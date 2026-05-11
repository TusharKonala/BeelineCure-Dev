import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publicDoctorByIdWhere } from "@/lib/doctor-visibility";

function firstName(name: string | null): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "Patient";
  return trimmed.split(/\s+/)[0] ?? "Patient";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ doctorId: string }> },
) {
  const { doctorId } = await context.params;
  const page = Math.max(
    1,
    Number(request.nextUrl.searchParams.get("page") ?? "1") || 1,
  );
  const limit = Math.min(
    20,
    Math.max(5, Number(request.nextUrl.searchParams.get("limit") ?? "10") || 10),
  );

  const doctor = await prisma.doctor.findFirst({
    where: publicDoctorByIdWhere(doctorId),
    select: {
      id: true,
      averageRating: true,
      reviewCount: true,
    },
  });

  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  const skip = (page - 1) * limit;
  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { doctorId: doctor.id },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        patient: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.review.count({ where: { doctorId: doctor.id } }),
  ]);

  return NextResponse.json({
    items: reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
      patientFirstName: firstName(review.patient.name),
    })),
    summary: {
      averageRating: doctor.averageRating,
      reviewCount: doctor.reviewCount,
    },
    hasMore: skip + reviews.length < total,
    total,
    page,
  });
}
