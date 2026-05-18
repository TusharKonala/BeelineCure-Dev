import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/careers-admin";
import { cancelInterviewRound } from "@/lib/careers-interview";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{ applicationId: string; roundId: string }>;
  },
) {
  const auth = await requireAdminSession();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { applicationId, roundId } = await context.params;
  if (!applicationId || !roundId) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const round = await prisma.interviewRound.findFirst({
    where: { id: roundId, applicationId },
    select: { id: true },
  });
  if (!round) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const result = await cancelInterviewRound(roundId);
  if ("error" in result) {
    if (result.error === "already_cancelled") {
      return NextResponse.json(
        { error: "Interview is already cancelled" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
