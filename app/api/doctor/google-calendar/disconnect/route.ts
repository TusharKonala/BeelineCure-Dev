import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@/generated/prisma/client";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== UserRole.DOCTOR) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!doctor) {
    return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });
  }

  await prisma.doctor.update({
    where: { id: doctor.id },
    data: {
      googleCalendarAccessToken: null,
      googleCalendarRefreshToken: null,
      googleCalendarAccessTokenExpiresAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
