import { NextRequest, NextResponse } from "next/server";
import {
  confirmInterviewRound,
  formatInterviewScheduledAt,
  isConfirmationTokenExpired,
  isInterviewRoundCancelled,
} from "@/lib/careers-interview";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const round = await prisma.interviewRound.findUnique({
    where: { confirmationToken: token },
    select: {
      roundNumber: true,
      scheduledAt: true,
      timezone: true,
      confirmedAt: true,
      meetLink: true,
      confirmationTokenExpiresAt: true,
      cancelledAt: true,
      application: {
        select: {
          name: true,
          candidateTimezone: true,
          jobPosting: { select: { title: true } },
        },
      },
    },
  });

  if (!round) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  if (
    isInterviewRoundCancelled(round.cancelledAt) ||
    isConfirmationTokenExpired(round.confirmationTokenExpiresAt)
  ) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  return NextResponse.json({
    jobTitle: round.application.jobPosting.title,
    candidateName: round.application.name,
    roundNumber: round.roundNumber,
    scheduledAt: round.scheduledAt.toISOString(),
    scheduledAtLabel: formatInterviewScheduledAt(
      round.scheduledAt,
      round.timezone,
      round.application.candidateTimezone,
    ),
    confirmed: Boolean(round.confirmedAt),
    confirmedAt: round.confirmedAt?.toISOString() ?? null,
    meetLink: round.meetLink,
  });
}

export async function POST(request: NextRequest) {
  const token =
    request.nextUrl.searchParams.get("token")?.trim() ||
    ((await request.json().catch(() => null)) as { token?: string } | null)
      ?.token
      ?.trim();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const result = await confirmInterviewRound(token);

  if ("error" in result) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    alreadyConfirmed: result.alreadyConfirmed,
    round: {
      ...result.round,
      scheduledAtLabel: result.round.scheduledAtLabel,
    },
  });
}
