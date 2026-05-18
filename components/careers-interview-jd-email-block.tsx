import * as React from "react";

export function CareersInterviewJdEmailBlock({
  jobDescription,
}: {
  jobDescription?: string | null;
}) {
  const text = jobDescription?.trim();
  if (!text) return null;

  return (
  <div style={{ marginTop: "1.5rem" }}>
      <p
        style={{
          color: "#333333",
          lineHeight: 1.6,
          fontWeight: 600,
          marginBottom: "0.5rem",
        }}
      >
        Job description
      </p>
      <p
        style={{
          color: "#5e5e5e",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          fontSize: "14px",
        }}
      >
        {text}
      </p>
    </div>
  );
}
