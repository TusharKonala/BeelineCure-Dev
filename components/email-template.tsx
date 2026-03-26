import * as React from "react";

export interface EmailTemplateProps {
  heading?: string;
  message?: string;
  showActionLinks?: boolean;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  patientName: string;
  consultationType: "CLINIC" | "ONLINE";
  cancelUrl: string;
  rescheduleUrl: string;
}

const getConfirmationMessage = (consultationType: "CLINIC" | "ONLINE") => {
  if (consultationType === "ONLINE") {
    return "Your online appointment is confirmed. Please be available at the scheduled time. To cancel or reschedule, use the links below.";
  }

  return "Your appointment is confirmed. Please arrive a few minutes early. To cancel or reschedule, use the links below.";
};

export function EmailTemplate({
  heading = "Appointment Confirmation",
  message,
  showActionLinks = true,
  doctorName,
  appointmentDate,
  appointmentTime,
  patientName,
  consultationType,
  cancelUrl,
  rescheduleUrl,
}: EmailTemplateProps) {
  return (
    <div
      style={{ fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto" }}
    >
      <h1 style={{ color: "#111111", marginBottom: "1rem" }}>
        {heading}
      </h1>
      <p style={{ color: "#333333", lineHeight: 1.6 }}>Hello {patientName},</p>
      <p style={{ color: "#333333", lineHeight: 1.6 }}>
        {" "}
        {message ?? getConfirmationMessage(consultationType)}
      </p>
      <div
        style={{
          marginTop: "1.5rem",
          padding: "1rem",
          backgroundColor: "#f5f5f5",
          borderRadius: "8px",
          border: "1px solid #e5e5e5",
        }}
      >
        <p style={{ margin: "0.25rem 0", color: "#111111" }}>
          <strong>Doctor:</strong> {doctorName}
        </p>
        <p style={{ margin: "0.25rem 0", color: "#111111" }}>
          <strong>Date:</strong> {appointmentDate}
        </p>
        <p style={{ margin: "0.25rem 0", color: "#111111" }}>
          <strong>Time:</strong> {appointmentTime}
        </p>
        <p style={{ margin: "0.25rem 0", color: "#111111" }}>
          <strong>Patient:</strong> {patientName}
        </p>
        <p style={{ margin: "0.25rem 0", color: "#111111" }}>
          <strong>Consultation Type:</strong>{" "}
          {consultationType === "ONLINE"
            ? "Online Consultation"
            : "Clinic Visit"}
        </p>
      </div>
      {consultationType === "ONLINE" && (
        <p style={{ marginTop: "1rem", color: "#333" }}>
          This is an online consultation. The doctor will contact you at the
          scheduled time.
        </p>
      )}
      {showActionLinks && (
        <>
          <div style={{ marginTop: "1rem" }}>
            <a
              href={cancelUrl}
              style={{
                color: "#2555F3",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Cancel Appointment
            </a>
          </div>
          <div style={{ marginTop: "0.75rem" }}>
            <a
              href={rescheduleUrl}
              style={{
                color: "#2555F3",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Reschedule Appointment
            </a>
          </div>
        </>
      )}
      <p
        style={{ color: "#5E5E5E", fontSize: "0.875rem", marginTop: "1.5rem" }}
      >
        Thank you for choosing our clinic.
      </p>
    </div>
  );
}
