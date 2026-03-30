import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const tokenSchema = z.string().min(1).max(1024);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";

  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) {
    return NextResponse.json({ status: "invalid_link" as const }, { status: 400 });
  }

  const tokenHash = createHash("sha256").update(parsed.data).digest("hex");
  const now = new Date();

  try {
    const user = await prisma.user.findFirst({
      where: { emailVerificationTokenHash: tokenHash },
    });

    if (!user) {
      return NextResponse.json(
        { status: "invalid_link" as const },
        { status: 404 },
      );
    }

    if (user.emailVerifiedAt) {
      return NextResponse.json({ status: "already_verified" as const });
    }

    if (
      !user.emailVerificationTokenExpiresAt ||
      user.emailVerificationTokenExpiresAt <= now
    ) {
      return NextResponse.json({ status: "expired" as const }, { status: 410 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationTokenExpiresAt: null,
      },
    });

    return NextResponse.json({ status: "success" as const });
  } catch (err) {
    console.error("[verify-email] Failed:", err);
    return NextResponse.json(
      { status: "server_error" as const },
      { status: 500 },
    );
  }
}

