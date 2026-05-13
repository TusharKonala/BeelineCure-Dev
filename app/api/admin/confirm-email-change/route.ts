import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

const tokenSchema = z.string().min(1).max(1024);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";

  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) {
    return NextResponse.json(
      { status: "invalid_link" as const },
      { status: 400 },
    );
  }

  const tokenHash = createHash("sha256").update(parsed.data).digest("hex");
  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: {
          emailChangeTokenHash: tokenHash,
          emailChangeTokenExpiresAt: { gt: now },
          role: UserRole.ADMIN,
        },
        select: {
          id: true,
          pendingEmail: true,
        },
      });

      if (!user) {
        const expired = await tx.user.findFirst({
          where: { emailChangeTokenHash: tokenHash, role: UserRole.ADMIN },
          select: { id: true, emailChangeTokenExpiresAt: true },
        });
        if (expired?.emailChangeTokenExpiresAt && expired.emailChangeTokenExpiresAt <= now) {
          return { status: "expired" as const };
        }
        return { status: "invalid_link" as const };
      }

      const pending = user.pendingEmail?.trim().toLowerCase();
      if (!pending) {
        return { status: "invalid_link" as const };
      }

      const taken = await tx.user.findFirst({
        where: {
          email: pending,
          NOT: { id: user.id },
        },
        select: { id: true },
      });
      if (taken) {
        return { status: "email_taken" as const };
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          email: pending,
          pendingEmail: null,
          emailChangeTokenHash: null,
          emailChangeTokenExpiresAt: null,
        },
      });

      return { status: "success" as const };
    });

    if (result.status === "expired") {
      return NextResponse.json({ status: "expired" as const }, { status: 410 });
    }
    if (result.status === "email_taken") {
      return NextResponse.json({ status: "email_taken" as const }, { status: 409 });
    }
    if (result.status === "invalid_link") {
      return NextResponse.json(
        { status: "invalid_link" as const },
        { status: 404 },
      );
    }

    return NextResponse.json({ status: "success" as const });
  } catch (err) {
    console.error("[admin/confirm-email-change] Failed:", err);
    return NextResponse.json(
      { status: "server_error" as const },
      { status: 500 },
    );
  }
}
