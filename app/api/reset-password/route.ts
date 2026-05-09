import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const tokenSchema = z.string().min(1).max(1024);
const resetPasswordSchema = z.object({
  token: tokenSchema,
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function getTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";

  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) {
    return NextResponse.json({ status: "invalid_link" as const }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { passwordResetTokenHash: getTokenHash(parsed.data) },
    select: {
      id: true,
      passwordResetTokenExpiresAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ status: "invalid_link" as const }, { status: 404 });
  }

  if (
    !user.passwordResetTokenExpiresAt ||
    user.passwordResetTokenExpiresAt <= new Date()
  ) {
    return NextResponse.json({ status: "expired" as const }, { status: 410 });
  }

  return NextResponse.json({ status: "valid" as const });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const tokenHash = getTokenHash(parsed.data.token);

  const user = await prisma.user.findFirst({
    where: { passwordResetTokenHash: tokenHash },
    select: {
      id: true,
      password: true,
      passwordResetTokenExpiresAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Invalid reset link" }, { status: 400 });
  }

  if (
    !user.passwordResetTokenExpiresAt ||
    user.passwordResetTokenExpiresAt <= new Date()
  ) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
      },
    });
    return NextResponse.json({ error: "Reset link has expired" }, { status: 400 });
  }

  if (user.password) {
    const isSameAsCurrent = await bcrypt.compare(
      parsed.data.password,
      user.password,
    );
    if (isSameAsCurrent) {
      return NextResponse.json(
        {
          error: "New password must be different from your current password.",
        },
        { status: 400 },
      );
    }
  }

  const nextPasswordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: nextPasswordHash,
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}

