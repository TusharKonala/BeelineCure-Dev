import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const search = request.nextUrl.searchParams;
  const page = Math.max(1, Number(search.get("page") ?? "1") || 1);
  const limit = Math.min(25, Math.max(5, Number(search.get("limit") ?? "10") || 10));

  if (page === 1) {
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  const skip = (page - 1) * limit;
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
    hasMore: skip + limit < total,
    total,
    page,
  });
}
