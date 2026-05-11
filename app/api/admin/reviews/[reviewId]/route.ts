import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recomputeDoctorReviewStats } from "@/lib/review-stats";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ reviewId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { reviewId } = await context.params;
  if (!reviewId) {
    return NextResponse.json({ error: "Invalid review id" }, { status: 400 });
  }

  const existing = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, doctorId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.review.delete({
      where: { id: reviewId },
    });
    await recomputeDoctorReviewStats(tx, existing.doctorId);
  });

  return NextResponse.json({ ok: true });
}
