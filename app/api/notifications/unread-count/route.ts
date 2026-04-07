import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ count: 0 }, { status: 401 });
  }

  const count = await prisma.notification.count({
    where: { userId, readAt: null },
  });

  return NextResponse.json({ count });
}
