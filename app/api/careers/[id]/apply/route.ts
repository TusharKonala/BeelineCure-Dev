import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { ApplicationStatus, UserRole } from "@/generated/prisma/client";
import { inngest } from "@/inngest/client";
import { authOptions } from "@/lib/auth";
import { jobApplicationSchema } from "@/lib/careers-schemas";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    const role = session.user.role;
    if (role === UserRole.DOCTOR || role === UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Staff accounts cannot apply for jobs." },
        { status: 403 },
      );
    }
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }

  const posting = await prisma.jobPosting.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });
  if (!posting || !posting.isActive) {
    return NextResponse.json({ error: "Job posting not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = jobApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { coverNote, resumeUrl, candidateTimezone, ...rest } = parsed.data;

  const existing = await prisma.jobApplication.findFirst({
    where: {
      jobPostingId: id,
      email: { equals: rest.email.trim(), mode: "insensitive" },
      status: { not: ApplicationStatus.REJECTED },
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You have already applied for this position." },
      { status: 409 },
    );
  }

  const application = await prisma.jobApplication.create({
    data: {
      jobPostingId: id,
      ...rest,
      coverNote: coverNote?.trim() || null,
      resumeUrl,
      candidateTimezone: candidateTimezone?.trim() || null,
    },
  });

  try {
    await inngest.send({
      name: "careers/application.submitted",
      data: { applicationId: application.id },
    });
  } catch (err) {
    console.error("[careers/apply] Failed to enqueue AI screening:", err);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
