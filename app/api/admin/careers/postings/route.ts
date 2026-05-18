import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/careers-admin";
import {
  cursorPageResult,
  parseCursorLimit,
} from "@/lib/careers-pagination";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const params = request.nextUrl.searchParams;
  const { limit, cursor } = parseCursorLimit(params);
  const search = params.get("search")?.trim();

  const rows = await prisma.jobPosting.findMany({
    where: search
      ? { title: { contains: search, mode: "insensitive" } }
      : undefined,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      isRemote: true,
      salaryRange: true,
      salaryCurrency: true,
      isActive: true,
      createdAt: true,
      _count: { select: { applications: true } },
    },
  });

  const { items, hasMore, nextCursor } = cursorPageResult(rows, limit);

  return NextResponse.json({
    items: items.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      type: p.type,
      isRemote: p.isRemote,
      salaryRange: p.salaryRange,
      salaryCurrency: p.salaryCurrency,
      isActive: p.isActive,
      createdAt: p.createdAt.toISOString(),
      applicationCount: p._count.applications,
    })),
    hasMore,
    nextCursor,
  });
}
