import { randomBytes } from "crypto";
import { Resend } from "resend";
import { CareersInterviewConfirmedEmailTemplate } from "@/components/careers-interview-confirmed-email-template";
import { CareersInterviewInviteEmailTemplate } from "@/components/careers-interview-invite-email-template";
import { createMeetEventForInterviewRound } from "@/lib/google-calendar-meet";
import { prisma } from "@/lib/db";

const resend = new Resend(process.env.RESEND_API_KEY);

function emailFrom() {
  return process.env.EMAIL_FROM ?? "Clinivo <onboarding@resend.dev>";
}

export function formatInterviewScheduledAt(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function resolveAppOrigin() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export async function sendInterviewInviteEmail(params: {
  to: string;
  candidateName: string;
  jobTitle: string;
  roundNumber: number;
  scheduledAt: Date;
  confirmationToken: string;
  notes?: string | null;
}) {
  const origin = resolveAppOrigin();
  const confirmUrl = `${origin}/careers/interview/confirm?token=${encodeURIComponent(params.confirmationToken)}`;
  const scheduledAtLabel = formatInterviewScheduledAt(params.scheduledAt);

  if (!process.env.RESEND_API_KEY?.trim()) {
    console.warn("[careers-interview] RESEND_API_KEY not set; skipping invite email");
    return;
  }

  await resend.emails.send({
    from: emailFrom(),
    to: params.to,
    subject: `Confirm your interview — ${params.jobTitle}`,
    react: CareersInterviewInviteEmailTemplate({
      candidateName: params.candidateName,
      jobTitle: params.jobTitle,
      roundNumber: params.roundNumber,
      scheduledAtLabel,
      confirmUrl,
      notes: params.notes,
    }),
  });
}

export async function sendInterviewConfirmedEmail(params: {
  to: string;
  candidateName: string;
  jobTitle: string;
  roundNumber: number;
  scheduledAt: Date;
  meetLink: string | null;
}) {
  const scheduledAtLabel = formatInterviewScheduledAt(params.scheduledAt);

  if (!process.env.RESEND_API_KEY?.trim()) {
    console.warn("[careers-interview] RESEND_API_KEY not set; skipping confirmed email");
    return;
  }

  await resend.emails.send({
    from: emailFrom(),
    to: params.to,
    subject: `Interview confirmed — ${params.jobTitle}`,
    react: CareersInterviewConfirmedEmailTemplate({
      candidateName: params.candidateName,
      jobTitle: params.jobTitle,
      roundNumber: params.roundNumber,
      scheduledAtLabel,
      meetLink: params.meetLink,
    }),
  });
}

export function generateConfirmationToken() {
  return randomBytes(32).toString("hex");
}

export async function confirmInterviewRound(token: string) {
  const round = await prisma.interviewRound.findUnique({
    where: { confirmationToken: token },
    include: {
      application: {
        select: {
          name: true,
          email: true,
          jobPosting: { select: { title: true } },
        },
      },
    },
  });

  if (!round) {
    return { error: "invalid_token" as const };
  }

  if (round.confirmedAt) {
    return {
      ok: true as const,
      alreadyConfirmed: true,
      round: {
        jobTitle: round.application.jobPosting.title,
        candidateName: round.application.name,
        roundNumber: round.roundNumber,
        scheduledAt: round.scheduledAt.toISOString(),
        meetLink: round.meetLink,
        confirmedAt: round.confirmedAt.toISOString(),
      },
    };
  }

  const confirmedAt = new Date();
  await prisma.interviewRound.update({
    where: { id: round.id },
    data: { confirmedAt },
  });

  const { meetLink } = await createMeetEventForInterviewRound(round.id);

  const updated = await prisma.interviewRound.findUnique({
    where: { id: round.id },
    select: { meetLink: true },
  });

  const finalMeetLink = updated?.meetLink ?? meetLink;

  try {
    await sendInterviewConfirmedEmail({
      to: round.application.email,
      candidateName: round.application.name,
      jobTitle: round.application.jobPosting.title,
      roundNumber: round.roundNumber,
      scheduledAt: round.scheduledAt,
      meetLink: finalMeetLink,
    });
  } catch (err) {
    console.error("[careers-interview] Failed to send confirmed email:", err);
  }

  return {
    ok: true as const,
    alreadyConfirmed: false,
    round: {
      jobTitle: round.application.jobPosting.title,
      candidateName: round.application.name,
      roundNumber: round.roundNumber,
      scheduledAt: round.scheduledAt.toISOString(),
      meetLink: finalMeetLink,
      confirmedAt: confirmedAt.toISOString(),
    },
  };
}
