import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/careers-admin";
import { createJobPostingSchema } from "@/lib/careers-schemas";
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

export async function GET() {
  const postings = await prisma.jobPosting.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: jobPostingSelect,
  });

  return NextResponse.json({
    postings: postings.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
    })),
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

  const { salaryRange, ...rest } = parsed.data;
  const posting = await prisma.jobPosting.create({
    data: {
      ...rest,
      salaryRange: salaryRange?.trim() || null,
    },
    select: jobPostingSelect,
  });

  return NextResponse.json(
    {
      posting: {
        ...posting,
        createdAt: posting.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
