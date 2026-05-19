import {
  ApplicationStatus,
  type Prisma,
} from "@/generated/prisma/client";

const statusValues = new Set<string>(Object.values(ApplicationStatus));

export type ApplicationsListParams = {
  status: ApplicationStatus | null;
  scoreMin: number | null;
  scoreMax: number | null;
  interviewRound: number | null;
};

export function parseApplicationsListParams(
  searchParams: URLSearchParams,
): ApplicationsListParams {
  const rawStatus = searchParams.get("status")?.trim();
  const status =
    rawStatus && statusValues.has(rawStatus)
      ? (rawStatus as ApplicationStatus)
      : null;

  const scoreMinRaw = searchParams.get("scoreMin");
  const scoreMaxRaw = searchParams.get("scoreMax");
  const scoreMin =
    scoreMinRaw !== null && scoreMinRaw !== ""
      ? Number(scoreMinRaw)
      : null;
  const scoreMax =
    scoreMaxRaw !== null && scoreMaxRaw !== ""
      ? Number(scoreMaxRaw)
      : null;

  const interviewRoundRaw = searchParams.get("interviewRound")?.trim();
  const interviewRound =
    interviewRoundRaw !== undefined &&
    interviewRoundRaw !== "" &&
    interviewRoundRaw !== "ALL"
      ? Number(interviewRoundRaw)
      : null;

  return { status, scoreMin, scoreMax, interviewRound };
}

export function buildJobApplicationWhereInput(
  params: ApplicationsListParams,
): Prisma.JobApplicationWhereInput {
  const { status, scoreMin, scoreMax, interviewRound } = params;
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

  if (
    interviewRound !== null &&
    Number.isInteger(interviewRound) &&
    interviewRound >= 1
  ) {
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

  return where;
}

export const SCORE_BAND_RANGES = [
  { scoreMin: 1, scoreMax: 4 },
  { scoreMin: 5, scoreMax: 7 },
  { scoreMin: 8, scoreMax: 10 },
] as const;

export function isValidScoreBandRange(
  scoreMin: number,
  scoreMax: number,
): boolean {
  return SCORE_BAND_RANGES.some(
    (band) => band.scoreMin === scoreMin && band.scoreMax === scoreMax,
  );
}

export function buildPendingScoreBandWhereInput(
  scoreMin: number,
  scoreMax: number,
): Prisma.JobApplicationWhereInput {
  return buildJobApplicationWhereInput({
    status: ApplicationStatus.PENDING,
    scoreMin,
    scoreMax,
    interviewRound: null,
  });
}
