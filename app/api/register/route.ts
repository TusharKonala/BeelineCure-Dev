import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { Resend } from "resend";
import { EmailVerificationTemplate } from "@/components/email-verification-template";

const registerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 },
    );
  }

  const hashed = await bcrypt.hash(password, 12);

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "Email service not configured" },
      { status: 500 },
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const verificationToken = randomBytes(32).toString("hex");
  const verificationTokenHash = createHash("sha256")
    .update(verificationToken)
    .digest("hex");
  const verificationTokenExpiresAt = new Date(
    Date.now() + 1000 * 60 * 60 * 24,
  ); // 24 hours

  const user = await prisma.user.create({
    data: {
      email,
      password: hashed,
      name: name ?? null,
      role: UserRole.PATIENT,
      emailVerifiedAt: null,
      emailVerificationTokenHash: verificationTokenHash,
      emailVerificationTokenExpiresAt: verificationTokenExpiresAt,
    },
  });

  const headersList = await headers();
  const origin =
    headersList.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "http://localhost:3000";

  const verificationUrl = `${origin}/auth/verify-email?token=${encodeURIComponent(
    verificationToken,
  )}`;

  try {
    const from = process.env.EMAIL_FROM ?? "Clinivo <onboarding@resend.dev>";

    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: "Verify your email",
      react: EmailVerificationTemplate({
        recipientName: user.name ?? "there",
        verificationUrl,
      }),
    });

    if (error) {
      console.error("[register] Verification email failed:", error);
      await prisma.user.delete({ where: { id: user.id } });
      return NextResponse.json(
        { error: "Unable to send verification email" },
        { status: 500 },
      );
    }
  } catch (err) {
    console.error("[register] Verification email threw error:", err);
    await prisma.user.delete({ where: { id: user.id } });
    return NextResponse.json(
      { error: "Unable to send verification email" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
