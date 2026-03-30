import * as React from "react";

export interface EmailVerificationTemplateProps {
  recipientName: string;
  verificationUrl: string;
}

export function EmailVerificationTemplate({
  recipientName,
  verificationUrl,
}: EmailVerificationTemplateProps) {
  return (
    <div
      style={{
        fontFamily: "sans-serif",
        maxWidth: "600px",
        margin: "0 auto",
        color: "#111111",
      }}
    >
      <h1 style={{ marginBottom: "1rem" }}>Verify your email</h1>
      <p style={{ color: "#333333", lineHeight: 1.6 }}>
        Hello {recipientName},
      </p>
      <p style={{ color: "#333333", lineHeight: 1.6 }}>
        Please verify your email address to finish creating your account.
        Click the link below:
      </p>

      <div style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
        <a
          href={verificationUrl}
          style={{
            display: "inline-block",
            padding: "12px 16px",
            backgroundColor: "#2555F3",
            color: "#ffffff",
            textDecoration: "none",
            borderRadius: "8px",
            fontWeight: 600,
          }}
        >
          Verify email
        </a>
      </div>

      <p style={{ color: "#5E5E5E", fontSize: "0.875rem", lineHeight: 1.6 }}>
        If you didn&apos;t create an account, you can safely ignore this email.
      </p>
    </div>
  );
}

