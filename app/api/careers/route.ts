import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/careers-admin";
import { jobPostingSelect, mapJobPosting } from "@/lib/careers-postings";
import { createJobPostingSchema } from "@/lib/careers-schemas";
import {
  cursorPageResult,
  parseCursorLimit,
} from "@/lib/careers-pagination";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { limit, cursor } = parseCursorLimit(request.nextUrl.searchParams);

  const rows = await prisma.jobPosting.findMany({
    where: { isActive: true },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: jobPostingSelect,
  });

  const { items, hasMore, nextCursor } = cursorPageResult(rows, limit);

  return NextResponse.json({
    items: items.map(mapJobPosting),
    hasMore,
    nextCursor,
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createJobPostingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { salaryRange, salaryCurrency, ...rest } = parsed.data;
  const posting = await prisma.jobPosting.create({
    data: {
      ...rest,
      salaryRange: salaryRange?.trim() || null,
      salaryCurrency: salaryCurrency ?? null,
    },
    select: jobPostingSelect,
  });

  return NextResponse.json(
    {
      posting: mapJobPosting(posting),
    },
    { status: 201 },
  );
}
