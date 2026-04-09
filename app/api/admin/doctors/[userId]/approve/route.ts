import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { DoctorApprovalStatus, UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await context.params;
  if (!userId) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const doctorProfile = await prisma.doctorProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!doctorProfile) {
    return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });
  }

  await prisma.doctorProfile.update({
    where: { userId },
    data: {
      approvalStatus: DoctorApprovalStatus.APPROVED,
      approvedAt: new Date(),
      approvedByUserId: session.user.id,
    },
  });

  return NextResponse.json({ ok: true });
}
