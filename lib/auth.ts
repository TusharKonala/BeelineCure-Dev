import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { z } from "zod";
import { DoctorApprovalStatus, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

async function authorizeMagicLink(rawToken: string) {
  if (rawToken.length > 1024) return null;
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: {
        magicLinkTokenHash: tokenHash,
        magicLinkTokenExpiresAt: { gt: now },
      },
      include: {
        doctor: {
          select: {
            approvalStatus: true,
          },
        },
      },
    });
    if (!user) return null;

    const cleared = await tx.user.updateMany({
      where: {
        id: user.id,
        magicLinkTokenHash: tokenHash,
        magicLinkTokenExpiresAt: { gt: now },
      },
      data: {
        magicLinkTokenHash: null,
        magicLinkTokenExpiresAt: null,
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      },
    });
    if (cleared.count !== 1) return null;

    if (user.role === UserRole.DOCTOR && user.profileComplete !== false) {
      if (user.doctor?.approvalStatus === DoctorApprovalStatus.REJECTED) {
        throw new Error("DOCTOR_REJECTED");
      }
      if (user.doctor?.approvalStatus !== DoctorApprovalStatus.APPROVED) {
        throw new Error("DOCTOR_NOT_APPROVED");
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      doctorApprovalStatus: user.doctor?.approvalStatus ?? null,
      profileComplete: user.profileComplete,
    };
  });
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        magicLinkToken: { label: "Magic link token", type: "text" },
      },
      async authorize(credentials) {
        const magicLinkToken =
          typeof credentials?.magicLinkToken === "string"
            ? credentials.magicLinkToken.trim()
            : "";
        if (magicLinkToken.length > 0) {
          return authorizeMagicLink(magicLinkToken);
        }

        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          include: {
            doctor: {
              select: {
                approvalStatus: true,
              },
            },
          },
        });
        if (!user?.password) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.password);
        if (!valid) return null;

        // Credentials sign-ins are blocked until the user verifies their email.
        // OAuth (e.g. Google) is unaffected.
        if (!user.emailVerifiedAt) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }
        if (user.role === UserRole.DOCTOR && user.profileComplete !== false) {
          if (user.doctor?.approvalStatus === DoctorApprovalStatus.REJECTED) {
            throw new Error("DOCTOR_REJECTED");
          }
          if (user.doctor?.approvalStatus !== DoctorApprovalStatus.APPROVED) {
            throw new Error("DOCTOR_NOT_APPROVED");
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          doctorApprovalStatus: user.doctor?.approvalStatus ?? null,
          profileComplete: user.profileComplete,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;

      const email = user.email?.trim().toLowerCase();
      if (!email) return true;

      const existingUser = await prisma.user.findUnique({
        where: { email },
        include: {
          doctor: {
            select: {
              approvalStatus: true,
            },
          },
        },
      });

      // Let incomplete Google-doctor onboarding continue to the profile form.
      if (!existingUser || existingUser.profileComplete === false) return true;
      if (existingUser.role !== UserRole.DOCTOR) return true;

      if (existingUser.doctor?.approvalStatus === DoctorApprovalStatus.REJECTED) {
        return "/auth/signin?error=DOCTOR_REJECTED";
      }
      if (existingUser.doctor?.approvalStatus !== DoctorApprovalStatus.APPROVED) {
        return "/auth/signin?error=DOCTOR_NOT_APPROVED";
      }

      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      if (user && account?.provider === "google") {
        const email = user.email;
        if (!email) {
          throw new Error("No email from Google");
        }

        const dbUser = await prisma.user.upsert({
          where: { email },
          create: {
            email,
            name: user.name,
            password: null,
            role: UserRole.PATIENT,
            emailVerifiedAt: new Date(),
            profileComplete: false,
          },
          update: {
            name: user.name ?? undefined,
            emailVerifiedAt: new Date(),
          },
          include: {
            doctor: {
              select: {
                approvalStatus: true,
              },
            },
          },
        });
        if (dbUser.role === UserRole.DOCTOR && dbUser.profileComplete !== false) {
          if (dbUser.doctor?.approvalStatus === DoctorApprovalStatus.REJECTED) {
            throw new Error("DOCTOR_REJECTED");
          }
          if (dbUser.doctor?.approvalStatus !== DoctorApprovalStatus.APPROVED) {
            throw new Error("DOCTOR_NOT_APPROVED");
          }
        }

        token.id = dbUser.id;
        token.role = dbUser.role;
        token.doctorApprovalStatus = dbUser.doctor?.approvalStatus ?? null;
        token.profileComplete = dbUser.profileComplete;
        return token;
      }

      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.doctorApprovalStatus = user.doctorApprovalStatus ?? null;
        token.profileComplete = user.profileComplete ?? true;
      }

      if (trigger === "update" && session) {
        if (typeof session.profileComplete === "boolean") {
          token.profileComplete = session.profileComplete;
        }
      }

      // Keep JWT claims in sync after onboarding actions that update DB state.
      if (token.id && token.profileComplete === false) {
        const latestUser = await prisma.user.findUnique({
          where: { id: token.id },
          include: {
            doctor: {
              select: {
                approvalStatus: true,
              },
            },
          },
        });
        if (latestUser) {
          token.role = latestUser.role;
          token.doctorApprovalStatus =
            latestUser.doctor?.approvalStatus ?? null;
          token.profileComplete = latestUser.profileComplete;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.doctorApprovalStatus = token.doctorApprovalStatus ?? null;
        session.user.profileComplete = token.profileComplete ?? true;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
