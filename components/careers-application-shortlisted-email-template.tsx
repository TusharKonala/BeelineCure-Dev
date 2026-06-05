import * as React from "react";

export interface CareersApplicationShortlistedEmailProps {
  candidateName: string;
  jobTitle: string;
}

export function CareersApplicationShortlistedEmailTemplate({
  candidateName,
  jobTitle,
}: CareersApplicationShortlistedEmailProps) {
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
        Thank you for applying for the <strong>{jobTitle}</strong> role at
        BeelineCure. We were impressed with your application and have shortlisted
        you for the next stage.
      </p>
      <p style={{ color: "#333333", lineHeight: 1.6 }}>
        We will be in touch soon to schedule next steps. Please keep an eye on
        your inbox.
      </p>
    </div>
  );
}
