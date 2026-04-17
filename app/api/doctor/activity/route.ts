import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ACTIVITY_WRITE_WINDOW_MS = 5 * 60 * 1000;

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.DOCTOR) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const writeBefore = new Date(now.getTime() - ACTIVITY_WRITE_WINDOW_MS);

  await prisma.doctor.updateMany({
    where: {
      userId,
      OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: writeBefore } }],
    },
    data: { lastSeenAt: now },
  });

  return NextResponse.json({ ok: true });
}
