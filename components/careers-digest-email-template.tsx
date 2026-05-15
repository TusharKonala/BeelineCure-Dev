import * as React from "react";

export interface CareersDigestEmailProps {
  totalCount: number;
  breakdownLines: string[];
  careersUrl: string;
}

export function CareersDigestEmailTemplate({
  totalCount,
  breakdownLines,
  careersUrl,
}: CareersDigestEmailProps) {
  return (
    <div
      style={{ fontFamily: "sans-serif", maxWidth: "640px", margin: "0 auto" }}
    >
      <h1 style={{ color: "#111111", marginBottom: "1rem" }}>
        New job applications
      </h1>
      <p style={{ color: "#333333", lineHeight: 1.6 }}>
        You received{" "}
        <strong>
          {totalCount} new application{totalCount === 1 ? "" : "s"}
        </strong>{" "}
        since the last digest.
      </p>
      {breakdownLines.length > 0 && (
        <ul style={{ color: "#333333", lineHeight: 1.8, paddingLeft: "1.25rem" }}>
          {breakdownLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <p style={{ marginTop: "1.5rem" }}>
        <a
          href={careersUrl}
          style={{
            color: "#2555F3",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Review applications in Admin → Careers
        </a>
      </p>
    </div>
  );
}
