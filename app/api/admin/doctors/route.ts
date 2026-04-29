import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doctors = await prisma.doctor.findMany({
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
  });

  return NextResponse.json({
    doctors: doctors.map((doctor) => ({
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
  });
}
