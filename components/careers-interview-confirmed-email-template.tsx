import * as React from "react";

export interface CareersInterviewConfirmedEmailProps {
  candidateName: string;
  jobTitle: string;
  roundNumber: number;
  scheduledAtLabel: string;
  meetLink: string | null;
}

export function CareersInterviewConfirmedEmailTemplate({
  candidateName,
  jobTitle,
  roundNumber,
  scheduledAtLabel,
  meetLink,
}: CareersInterviewConfirmedEmailProps) {
  return (
    <div
      style={{ fontFamily: "sans-serif", maxWidth: "640px", margin: "0 auto" }}
    >
      <h1 style={{ color: "#111111", marginBottom: "1rem" }}>
        Interview confirmed
      </h1>
      <p style={{ color: "#333333", lineHeight: 1.6 }}>
        Hi {candidateName},
      </p>
      <p style={{ color: "#333333", lineHeight: 1.6 }}>
        Your <strong>Round {roundNumber}</strong> interview for{" "}
        <strong>{jobTitle}</strong> is confirmed for:
      </p>
      <p style={{ color: "#333333", lineHeight: 1.6, fontWeight: 600 }}>
        {scheduledAtLabel}
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
      ) : (
        <p style={{ color: "#5e5e5e", lineHeight: 1.6 }}>
          We will send your meeting link separately if it is not available yet.
        </p>
      )}
    </div>
  );
}
