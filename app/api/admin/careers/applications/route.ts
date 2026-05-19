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
import { MAX_INTERVIEW_ROUNDS } from "@/lib/careers-schemas";
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

  const interviewRoundRaw = params.get("interviewRound")?.trim();
  const interviewRound =
    interviewRoundRaw !== undefined &&
    interviewRoundRaw !== "" &&
    interviewRoundRaw !== "ALL"
      ? Number(interviewRoundRaw)
      : null;

  const activeRoundWhere = { cancelledAt: null };

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

  if (interviewRound !== null && Number.isInteger(interviewRound) && interviewRound >= 1) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        interviewRounds: {
          some: { roundNumber: interviewRound, ...activeRoundWhere },
        },
      },
      {
        NOT: {
          interviewRounds: {
            some: { roundNumber: { gt: interviewRound }, ...activeRoundWhere },
          },
        },
      },
    ];
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
      _count: { select: { interviewRounds: true } },
      interviewRounds: {
        where: activeRoundWhere,
        select: {
          id: true,
          roundNumber: true,
          scheduledAt: true,
          timezone: true,
          confirmedAt: true,
          attendeeEmail: true,
          notes: true,
        },
        orderBy: { roundNumber: "asc" },
      },
    },
  });

  const { items, hasMore, nextCursor } = cursorPageResult(rows, limit);

  return NextResponse.json({
    items: items.map((a) => {
      const activeRounds = a.interviewRounds;
      const latestInterviewRound =
        activeRounds.length > 0
          ? activeRounds[activeRounds.length - 1]!.roundNumber
          : null;
      const totalInterviewRoundCount = a._count.interviewRounds;

      return {
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
        latestInterviewRound,
        totalInterviewRoundCount,
        canScheduleInterview:
          totalInterviewRoundCount < MAX_INTERVIEW_ROUNDS,
        interviewRounds: activeRounds.map((r) => ({
          id: r.id,
          roundNumber: r.roundNumber,
          scheduledAt: r.scheduledAt.toISOString(),
          timezone: r.timezone,
          confirmedAt: r.confirmedAt?.toISOString() ?? null,
          attendeeEmail: r.attendeeEmail,
          notes: r.notes,
        })),
      };
    }),
    hasMore,
    nextCursor,
  });
}
