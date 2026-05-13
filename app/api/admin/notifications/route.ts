import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(
    25,
    Math.max(5, Number(request.nextUrl.searchParams.get("limit") ?? "10") || 10),
  );
  const skip = (page - 1) * limit;

  if (page === 1) {
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        message: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where: { userId } }),
  ]);

  return NextResponse.json({
    items,
    hasMore: skip + items.length < total,
    total,
    page,
  });
}
