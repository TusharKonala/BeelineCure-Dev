import {
  ApplicationStatus,
  type Prisma,
} from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/careers-admin";
import {
  cursorPageResult,
  parseCursorLimit,
} from "@/lib/careers-pagination";
import { prisma } from "@/lib/db";

const statusValues = new Set<string>(Object.values(ApplicationStatus));

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const params = request.nextUrl.searchParams;
  const { limit, cursor } = parseCursorLimit(params);

  const rawStatus = params.get("status")?.trim();
  const status =
    rawStatus && statusValues.has(rawStatus)
      ? (rawStatus as ApplicationStatus)
      : null;

  const scoreMinRaw = params.get("scoreMin");
  const scoreMaxRaw = params.get("scoreMax");
  const scoreMin =
    scoreMinRaw !== null && scoreMinRaw !== ""
      ? Number(scoreMinRaw)
      : null;
  const scoreMax =
    scoreMaxRaw !== null && scoreMaxRaw !== ""
      ? Number(scoreMaxRaw)
      : null;

  const where: Prisma.JobApplicationWhereInput = {};
  if (status) where.status = status;
  if (scoreMin !== null && Number.isFinite(scoreMin)) {
    where.aiScore = { ...(where.aiScore as Prisma.IntFilter), gte: scoreMin };
  }
  if (scoreMax !== null && Number.isFinite(scoreMax)) {
    where.aiScore = { ...(where.aiScore as Prisma.IntFilter), lte: scoreMax };
  }
  if (
    (scoreMin !== null && Number.isFinite(scoreMin)) ||
    (scoreMax !== null && Number.isFinite(scoreMax))
  ) {
    where.aiScore = {
      ...(typeof where.aiScore === "object" ? where.aiScore : {}),
      not: null,
    };
  }

  const rows = await prisma.jobApplication.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      coverNote: true,
      resumeText: true,
      resumeUrl: true,
      status: true,
      aiScore: true,
      aiSummary: true,
      aiRecommendation: true,
      createdAt: true,
      jobPosting: { select: { id: true, title: true } },
    },
  });

  const { items, hasMore, nextCursor } = cursorPageResult(rows, limit);

  return NextResponse.json({
    items: items.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      phone: a.phone,
      coverNote: a.coverNote,
      resumeText: a.resumeText,
      resumeUrl: a.resumeUrl,
      status: a.status,
      aiScore: a.aiScore,
      aiSummary: a.aiSummary,
      aiRecommendation: a.aiRecommendation,
      createdAt: a.createdAt.toISOString(),
      jobPostingId: a.jobPosting.id,
      jobTitle: a.jobPosting.title,
    })),
    hasMore,
    nextCursor,
  });
}
