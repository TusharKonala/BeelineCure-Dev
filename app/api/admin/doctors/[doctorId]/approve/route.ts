import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { DoctorApprovalStatus, UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { assignUniqueDoctorSlug } from "@/lib/doctor-slug";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
  context: { params: Promise<{ doctorId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { doctorId } = await context.params;
  if (!doctorId) {
    return NextResponse.json({ error: "Invalid doctor id" }, { status: 400 });
  }

  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { id: true, userId: true, name: true },
  });
  if (!doctor) {
    return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });
  }
  if (!doctor.userId) {
    return NextResponse.json(
      { error: "This doctor has no user account; approval is not applicable." },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.doctor.update({
      where: { id: doctorId },
      data: {
        approvalStatus: DoctorApprovalStatus.APPROVED,
        approvedAt: new Date(),
        approvedByUserId: session.user.id,
        isActive: true,
      },
    });
    await assignUniqueDoctorSlug(tx, {
      doctorId,
      name: doctor.name,
    });
  });

  return NextResponse.json({ ok: true });
}
