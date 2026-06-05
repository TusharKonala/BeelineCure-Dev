import * as React from "react";

export interface AdminEmailChangeTemplateProps {
  recipientName: string;
  confirmUrl: string;
  currentEmail: string;
}

export function AdminEmailChangeTemplate({
  recipientName,
  confirmUrl,
  currentEmail,
}: AdminEmailChangeTemplateProps) {
  return (
    <div
      style={{
        fontFamily: "sans-serif",
        maxWidth: "600px",
        margin: "0 auto",
        color: "#111111",
      }}
    >
      <h1 style={{ marginBottom: "1rem" }}>Confirm your new email</h1>
      <p style={{ color: "#333333", lineHeight: 1.6 }}>
        Hello {recipientName},
      </p>
      <p style={{ color: "#333333", lineHeight: 1.6 }}>
        You requested to change the email on your BeelineCure admin account. Until
        you confirm, you can still sign in with{" "}
        <strong>{currentEmail}</strong>.
      </p>
      <p style={{ color: "#333333", lineHeight: 1.6 }}>
        Click the button below to confirm this address as your new login email:
      </p>

      <div style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
        <a
          href={confirmUrl}
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
          Confirm new email
        </a>
      </div>

      <p style={{ color: "#5E5E5E", fontSize: "0.875rem", lineHeight: 1.6 }}>
        If you didn&apos;t request this change, you can ignore this email. Your
        account will keep using {currentEmail} to sign in.
      </p>
    </div>
  );
}
