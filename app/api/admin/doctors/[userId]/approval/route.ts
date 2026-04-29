import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { DoctorApprovalStatus, UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
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

  const body = (await request.json().catch(() => null)) as {
    status?: DoctorApprovalStatus;
  } | null;
  const nextStatus = body?.status;
  if (nextStatus !== "APPROVED" && nextStatus !== "REJECTED") {
    return NextResponse.json(
      { error: "Invalid status. Use APPROVED or REJECTED." },
      { status: 400 },
    );
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!doctor) {
    return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });
  }

  await prisma.doctor.update({
    where: { userId },
    data:
      nextStatus === "APPROVED"
        ? {
            approvalStatus: DoctorApprovalStatus.APPROVED,
            approvedAt: new Date(),
            approvedByUserId: session.user.id,
          }
        : {
            approvalStatus: DoctorApprovalStatus.REJECTED,
            approvedAt: null,
            approvedByUserId: null,
          },
  });

  return NextResponse.json({ ok: true });
}
