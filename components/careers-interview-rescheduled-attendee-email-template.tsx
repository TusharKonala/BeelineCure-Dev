import * as React from "react";
import { CareersInterviewJdEmailBlock } from "@/components/careers-interview-jd-email-block";

export interface CareersInterviewRescheduledAttendeeEmailProps {
  candidateName: string;
  jobTitle: string;
  roundNumber: number;
  previousScheduledAtLabel: string;
  scheduledAtLabel: string;
  meetLink: string | null;
  jobDescription?: string | null;
}

export function CareersInterviewRescheduledAttendeeEmailTemplate({
  candidateName,
  jobTitle,
  roundNumber,
  previousScheduledAtLabel,
  scheduledAtLabel,
  meetLink,
  jobDescription,
}: CareersInterviewRescheduledAttendeeEmailProps) {
  return (
    <div
      style={{ fontFamily: "sans-serif", maxWidth: "640px", margin: "0 auto" }}
    >
      <h1 style={{ color: "#111111", marginBottom: "1rem" }}>
        Interview rescheduled
      </h1>
      <p style={{ color: "#333333", lineHeight: 1.6, fontStyle: "normal" }}>
        Hi,
      </p>
      <p style={{ color: "#333333", lineHeight: 1.6 }}>
        The <strong>Round {roundNumber}</strong> interview for{" "}
        <strong>{jobTitle}</strong> with <strong>{candidateName}</strong> has
        been rescheduled.
      </p>
      <p style={{ color: "#5e5e5e", lineHeight: 1.6 }}>
        Previous time: {previousScheduledAtLabel}
      </p>
      <p style={{ color: "#333333", lineHeight: 1.6, fontWeight: 600 }}>
        New time: {scheduledAtLabel}
      </p>
      {meetLink ? (
        <p style={{ marginTop: "1.5rem" }}>
          <a
            href={meetLink}
            style={{
              color: "#2555F3",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Join Google Meet
          </a>
        </p>
      ) : null}
      <CareersInterviewJdEmailBlock jobDescription={jobDescription} />
    </div>
  );
}
