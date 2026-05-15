import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/careers-admin";
import { prisma } from "@/lib/db";

export async function GET() {
  const auth = await requireAdminSession();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const [postings, applications] = await Promise.all([
    prisma.jobPosting.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        isRemote: true,
        salaryRange: true,
        isActive: true,
        createdAt: true,
        _count: { select: { applications: true } },
      },
    }),
    prisma.jobApplication.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        coverNote: true,
        resumeUrl: true,
        createdAt: true,
        jobPosting: { select: { id: true, title: true } },
      },
    }),
  ]);

  return NextResponse.json({
    postings: postings.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      type: p.type,
      isRemote: p.isRemote,
      salaryRange: p.salaryRange,
      isActive: p.isActive,
      createdAt: p.createdAt.toISOString(),
      applicationCount: p._count.applications,
    })),
    applications: applications.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      phone: a.phone,
      coverNote: a.coverNote,
      resumeUrl: a.resumeUrl,
      createdAt: a.createdAt.toISOString(),
      jobPostingId: a.jobPosting.id,
      jobTitle: a.jobPosting.title,
    })),
  });
}
