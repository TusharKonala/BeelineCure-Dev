import * as React from "react";

export interface CareersApplicationRejectedEmailProps {
  candidateName: string;
  jobTitle: string;
}

export function CareersApplicationRejectedEmailTemplate({
  candidateName,
  jobTitle,
}: CareersApplicationRejectedEmailProps) {
  return (
    <div
      style={{ fontFamily: "sans-serif", maxWidth: "640px", margin: "0 auto" }}
    >
      <h1 style={{ color: "#111111", marginBottom: "1rem" }}>
        Application update
      </h1>
      <p style={{ color: "#333333", lineHeight: 1.6, fontStyle: "normal" }}>
        Hi {candidateName},
      </p>
      <p style={{ color: "#333333", lineHeight: 1.6 }}>
        Thank you for your interest in the <strong>{jobTitle}</strong> position
        at Clinivo and for the time you invested in your application.
      </p>
      <p style={{ color: "#333333", lineHeight: 1.6 }}>
        After careful consideration, we will not be moving forward with your
        application at this time. We encourage you to apply for future openings
        that match your experience.
      </p>
      <p style={{ color: "#333333", lineHeight: 1.6 }}>
        We wish you the best in your job search.
      </p>
    </div>
  );
}
