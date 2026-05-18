import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/careers-admin";
import { jobPostingSelect, mapJobPosting } from "@/lib/careers-postings";
import { updateJobPostingSchema } from "@/lib/careers-schemas";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }

  const posting = await prisma.jobPosting.findFirst({
    where: { id, isActive: true },
    select: jobPostingSelect,
  });

  if (!posting) {
    return NextResponse.json({ error: "Job posting not found" }, { status: 404 });
  }

  return NextResponse.json({ posting: mapJobPosting(posting) });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateJobPostingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const existing = await prisma.jobPosting.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Job posting not found" }, { status: 404 });
  }

  const data = parsed.data;
  const posting = await prisma.jobPosting.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.isRemote !== undefined ? { isRemote: data.isRemote } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.salaryRange !== undefined
        ? { salaryRange: data.salaryRange?.trim() || null }
        : {}),
      ...(data.salaryCurrency !== undefined
        ? { salaryCurrency: data.salaryCurrency ?? null }
        : {}),
    },
    select: jobPostingSelect,
  });

  return NextResponse.json({
    posting: mapJobPosting(posting),
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }

  const existing = await prisma.jobPosting.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Job posting not found" }, { status: 404 });
  }

  await prisma.jobPosting.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
