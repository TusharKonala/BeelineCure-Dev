export interface PasswordResetTemplateProps {
  recipientName: string;
  resetUrl: string;
  mode?: "reset" | "set";
}

export function PasswordResetTemplate({
  recipientName,
  resetUrl,
  mode = "reset",
}: PasswordResetTemplateProps) {
  const isSet = mode === "set";
  return (
    <div
      style={{
        fontFamily: "sans-serif",
        maxWidth: "600px",
        margin: "0 auto",
        color: "#111111",
      }}
    >
      <h1 style={{ marginBottom: "1rem" }}>
        {isSet ? "Set your password" : "Reset your password"}
      </h1>
      <p style={{ color: "#333333", lineHeight: 1.6 }}>
        Hello {recipientName},
      </p>
      <p style={{ color: "#333333", lineHeight: 1.6 }}>
        {isSet
          ? "Click the button below to set your password for the first time. This link expires in 1 hour."
          : "We received a request to reset your password. Click the button below to set a new one. This link expires in 1 hour."}
      </p>
      <div style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
        <a
          href={resetUrl}
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
          {isSet ? "Set password" : "Reset password"}
        </a>
      </div>
      <p style={{ color: "#5E5E5E", fontSize: "0.875rem", lineHeight: 1.6 }}>
        If you did not request this, you can ignore this email.
      </p>
    </div>
  );
}
