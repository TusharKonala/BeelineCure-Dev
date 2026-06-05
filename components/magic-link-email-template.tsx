import * as React from "react";

export interface MagicLinkEmailTemplateProps {
  recipientName: string;
  signInUrl: string;
}

export function MagicLinkEmailTemplate({
  recipientName,
  signInUrl,
}: MagicLinkEmailTemplateProps) {
  return (
    <div
      style={{
        fontFamily: "sans-serif",
        maxWidth: "600px",
        margin: "0 auto",
        color: "#111111",
      }}
    >
      <h1 style={{ marginBottom: "1rem" }}>Sign in to BeelineCure</h1>
      <p style={{ color: "#333333", lineHeight: 1.6 }}>Hello {recipientName},</p>
      <p style={{ color: "#333333", lineHeight: 1.6 }}>
        Click the button below to sign in. This link expires in 15 minutes and can
        only be used once.
      </p>
      <div style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
        <a
          href={signInUrl}
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
          Sign in
        </a>
      </div>
      <p style={{ color: "#5E5E5E", fontSize: "0.875rem", lineHeight: 1.6 }}>
        If you did not request this email, you can ignore it.
      </p>
    </div>
  );
}
