import { randomBytes } from "crypto";
import { Resend } from "resend";
import { CareersInterviewAttendeeConfirmedEmailTemplate } from "@/components/careers-interview-attendee-confirmed-email-template";
import { CareersInterviewConfirmedEmailTemplate } from "@/components/careers-interview-confirmed-email-template";
import { CareersInterviewInviteEmailTemplate } from "@/components/careers-interview-invite-email-template";
import { inngest } from "@/inngest/client";
import { formatInterviewTime } from "@/lib/careers-interview-time";
import { createMeetEventForInterviewRound } from "@/lib/google-calendar-meet";
import { prisma } from "@/lib/db";
import {
  interviewReminder24hAtMs,
  interviewReminder30mAtMs,
} from "@/lib/reminder-time";

const resend = new Resend(process.env.RESEND_API_KEY);

const TOKEN_EXPIRY_MS = 48 * 60 * 60 * 1000;

function emailFrom() {
  return process.env.EMAIL_FROM ?? "Clinivo <onboarding@resend.dev>";
}

export function formatInterviewScheduledAt(
  date: Date,
  adminTimezone: string,
  candidateTimezone?: string | null,
) {
  return formatInterviewTime(date, adminTimezone, candidateTimezone);
}

export function resolveAppOrigin() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function confirmationTokenExpiresAtFromNow() {
  return new Date(Date.now() + TOKEN_EXPIRY_MS);
}

export function isConfirmationTokenExpired(expiresAt: Date | null | undefined) {
  if (!expiresAt) return false;
  return expiresAt.getTime() < Date.now();
}

export async function sendInterviewInviteEmail(params: {
  to: string;
  candidateName: string;
  jobTitle: string;
  roundNumber: number;
  scheduledAt: Date;
  adminTimezone: string;
  candidateTimezone?: string | null;
  confirmationToken: string;
  notes?: string | null;
}) {
  const origin = resolveAppOrigin();
  const confirmUrl = `${origin}/careers/interview/confirm?token=${encodeURIComponent(params.confirmationToken)}`;
  const scheduledAtLabel = formatInterviewScheduledAt(
    params.scheduledAt,
    params.adminTimezone,
    params.candidateTimezone,
  );

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
  adminTimezone: string;
  candidateTimezone?: string | null;
  meetLink: string | null;
}) {
  const scheduledAtLabel = formatInterviewScheduledAt(
    params.scheduledAt,
    params.adminTimezone,
    params.candidateTimezone,
  );

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

export async function sendInterviewAttendeeConfirmedEmail(params: {
  to: string;
  candidateName: string;
  jobTitle: string;
  roundNumber: number;
  scheduledAt: Date;
  adminTimezone: string;
  meetLink: string | null;
}) {
  const scheduledAtLabel = formatInterviewScheduledAt(
    params.scheduledAt,
    params.adminTimezone,
  );

  if (!process.env.RESEND_API_KEY?.trim()) {
    console.warn(
      "[careers-interview] RESEND_API_KEY not set; skipping attendee confirmed email",
    );
    return;
  }

  await resend.emails.send({
    from: emailFrom(),
    to: params.to,
    subject: `Interview scheduled — ${params.jobTitle} (Round ${params.roundNumber})`,
    react: CareersInterviewAttendeeConfirmedEmailTemplate({
      candidateName: params.candidateName,
      jobTitle: params.jobTitle,
      roundNumber: params.roundNumber,
      scheduledAtLabel,
      meetLink: params.meetLink,
    }),
  });
}

async function scheduleInterviewReminders(roundId: string) {
  const round = await prisma.interviewRound.findUnique({
    where: { id: roundId },
    select: { scheduledAt: true },
  });
  if (!round) return;

  const ts24h = interviewReminder24hAtMs(round.scheduledAt);
  const ts30m = interviewReminder30mAtMs(round.scheduledAt);

  const recipients: Array<"candidate" | "attendee"> = ["candidate", "attendee"];

  for (const recipient of recipients) {
    if (ts24h !== null) {
      try {
        await inngest.send({
          name: "interview/reminder-24h.scheduled",
          data: { interviewRoundId: roundId, recipient },
          ts: ts24h,
        });
      } catch (err) {
        console.error("[careers-interview] Failed to schedule 24h reminder:", err);
      }
    }
    if (ts30m !== null) {
      try {
        await inngest.send({
          name: "interview/reminder-30m.scheduled",
          data: { interviewRoundId: roundId, recipient },
          ts: ts30m,
        });
      } catch (err) {
        console.error("[careers-interview] Failed to schedule 30m reminder:", err);
      }
    }
  }
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
          candidateTimezone: true,
          jobPosting: { select: { title: true } },
        },
      },
    },
  });

  if (!round) {
    return { error: "invalid_token" as const };
  }

  if (isConfirmationTokenExpired(round.confirmationTokenExpiresAt)) {
    return { error: "expired_token" as const };
  }

  const adminTimezone = round.timezone;
  const candidateTimezone = round.application.candidateTimezone;

  if (round.confirmedAt) {
    return {
      ok: true as const,
      alreadyConfirmed: true,
      round: {
        jobTitle: round.application.jobPosting.title,
        candidateName: round.application.name,
        roundNumber: round.roundNumber,
        scheduledAt: round.scheduledAt.toISOString(),
        scheduledAtLabel: formatInterviewScheduledAt(
          round.scheduledAt,
          adminTimezone,
          candidateTimezone,
        ),
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
    select: { meetLink: true, attendeeEmail: true },
  });

  const finalMeetLink = updated?.meetLink ?? meetLink;

  try {
    await sendInterviewConfirmedEmail({
      to: round.application.email,
      candidateName: round.application.name,
      jobTitle: round.application.jobPosting.title,
      roundNumber: round.roundNumber,
      scheduledAt: round.scheduledAt,
      adminTimezone,
      candidateTimezone,
      meetLink: finalMeetLink,
    });
  } catch (err) {
    console.error("[careers-interview] Failed to send confirmed email:", err);
  }

  const attendeeEmail = updated?.attendeeEmail?.trim();
  if (attendeeEmail) {
    try {
      await sendInterviewAttendeeConfirmedEmail({
        to: attendeeEmail,
        candidateName: round.application.name,
        jobTitle: round.application.jobPosting.title,
        roundNumber: round.roundNumber,
        scheduledAt: round.scheduledAt,
        adminTimezone,
        meetLink: finalMeetLink,
      });
    } catch (err) {
      console.error(
        "[careers-interview] Failed to send attendee confirmed email:",
        err,
      );
    }
  }

  try {
    await scheduleInterviewReminders(round.id);
  } catch (err) {
    console.error("[careers-interview] Failed to schedule reminders:", err);
  }

  return {
    ok: true as const,
    alreadyConfirmed: false,
    round: {
      jobTitle: round.application.jobPosting.title,
      candidateName: round.application.name,
      roundNumber: round.roundNumber,
      scheduledAt: round.scheduledAt.toISOString(),
      scheduledAtLabel: formatInterviewScheduledAt(
        round.scheduledAt,
        adminTimezone,
        candidateTimezone,
      ),
      meetLink: finalMeetLink,
      confirmedAt: confirmedAt.toISOString(),
    },
  };
}
