import { getServerSession } from "next-auth/next";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { profileComplete: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.profileComplete) {
    return NextResponse.json(
      { error: "Onboarding already completed" },
      { status: 409 },
    );
  }

  await prisma.user.delete({
    where: { id: session.user.id },
  });

  const headersList = await headers();
  const origin =
    headersList.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "http://localhost:3000";

  return NextResponse.json({
    ok: true,
    redirectUrl: `${origin}/auth/signup?role=doctor`,
  });
}
