import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/careers-admin";
import { prisma } from "@/lib/db";

export async function POST() {
  const auth = await requireAdminSession();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  await prisma.user.update({
    where: { id: auth.session.user.id },
    data: {
      googleCalendarAccessToken: null,
      googleCalendarRefreshToken: null,
      googleCalendarAccessTokenExpiresAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
