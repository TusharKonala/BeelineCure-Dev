import { ApplicationStatus } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/careers-admin";
import { sendApplicationStatusChangeEmail } from "@/lib/careers-application-status-email";
import {
  buildPendingScoreBandWhereInput,
  isValidScoreBandRange,
} from "@/lib/careers-applications-query";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  status: z.enum([
    ApplicationStatus.SHORTLISTED,
    ApplicationStatus.REJECTED,
  ]),
  scoreMin: z.number().int(),
  scoreMax: z.number().int(),
});

export async function PATCH(request: Request) {
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { status, scoreMin, scoreMax } = parsed.data;
  if (!isValidScoreBandRange(scoreMin, scoreMax)) {
    return NextResponse.json(
      { error: "Invalid score band range" },
      { status: 400 },
    );
  }

  const where = buildPendingScoreBandWhereInput(scoreMin, scoreMax);

  const targets = await prisma.jobApplication.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      jobPosting: { select: { title: true } },
    },
  });

  if (targets.length === 0) {
    return NextResponse.json({ updatedCount: 0 });
  }

  await prisma.jobApplication.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { status },
  });

  for (const target of targets) {
    try {
      await sendApplicationStatusChangeEmail({
        status,
        to: target.email,
        candidateName: target.name,
        jobTitle: target.jobPosting.title,
      });
    } catch (err) {
      console.error(
        "[careers-application-bulk] Failed to send status email:",
        target.id,
        err,
      );
    }
  }

  return NextResponse.json({ updatedCount: targets.length });
}
