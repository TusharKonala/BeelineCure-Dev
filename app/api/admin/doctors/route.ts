import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { DoctorApprovalStatus, UserRole, type Prisma } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const search = (request.nextUrl.searchParams.get("search") ?? "").trim();
  const rawStatus = request.nextUrl.searchParams.get("status");
  const status =
    rawStatus === "PENDING" || rawStatus === "APPROVED" || rawStatus === "REJECTED"
      ? rawStatus
      : null;
  const page = Math.max(
    1,
    Number(request.nextUrl.searchParams.get("page") ?? "1") || 1,
  );
  const limit = Math.min(
    20,
    Math.max(5, Number(request.nextUrl.searchParams.get("limit") ?? "10") || 10),
  );

  const where: Prisma.DoctorWhereInput = {};
  if (status) {
    where.approvalStatus = status as DoctorApprovalStatus;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      {
        user: {
          is: {
            email: { contains: search, mode: "insensitive" },
          },
        },
      },
    ];
  }

  const skip = (page - 1) * limit;
  const [doctors, total] = await Promise.all([
    prisma.doctor.findMany({
      where,
      select: {
        id: true,
        userId: true,
        name: true,
        specialization: true,
        licenseNumber: true,
        yearsExperience: true,
        profilePhotoUrl: true,
        approvalStatus: true,
        createdAt: true,
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.doctor.count({ where }),
  ]);

  return NextResponse.json({
    items: doctors.map((doctor) => ({
      id: doctor.id,
      userId: doctor.userId,
      name: doctor.name,
      email: doctor.user?.email ?? null,
      specialization: doctor.specialization,
      licenseNumber: doctor.licenseNumber,
      yearsExperience: doctor.yearsExperience,
      profilePhotoUrl: doctor.profilePhotoUrl,
      approvalStatus: doctor.approvalStatus,
      createdAt: doctor.createdAt.toISOString(),
    })),
    hasMore: skip + doctors.length < total,
    total,
    page,
  });
}
