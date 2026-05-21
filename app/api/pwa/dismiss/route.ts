import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    reason?: unknown;
  } | null;

  const reason = body?.reason;
  const now = new Date();

  if (reason === "installed") {
    await prisma.user.update({
      where: { id: userId },
      data: { pwaInstalledAt: now },
    });
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { pwaDismissedAt: now },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ showBanner: false });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pwaInstalledAt: true, pwaDismissedAt: true },
  });

  const showBanner = !user?.pwaInstalledAt && !user?.pwaDismissedAt;
  return NextResponse.json({ showBanner });
}
