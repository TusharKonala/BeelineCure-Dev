import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/careers-admin";
import { updateJobPostingSchema } from "@/lib/careers-schemas";
import { prisma } from "@/lib/db";

const jobPostingSelect = {
  id: true,
  title: true,
  description: true,
  type: true,
  isRemote: true,
  salaryRange: true,
  isActive: true,
  createdAt: true,
} as const;

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
    },
    select: jobPostingSelect,
  });

  return NextResponse.json({
    posting: {
      ...posting,
      createdAt: posting.createdAt.toISOString(),
    },
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
