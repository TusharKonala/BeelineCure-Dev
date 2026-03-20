import * as React from "react";

export interface EmailTemplateProps {
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  patientName: string;
  consultationType: "CLINIC" | "ONLINE";
}

const getConfirmationMessage = (consultationType: "CLINIC" | "ONLINE") => {
  if (consultationType === "ONLINE") {
    return "Your online appointment has been confirmed. Please be available at the scheduled time. If you need to reschedule or cancel, please contact the clinic.";
  }

  return "Your appointment has been confirmed. Please arrive a few minutes early. If you need to reschedule or cancel, please contact the clinic.";
};

export function EmailTemplate({
  doctorName,
  appointmentDate,
  appointmentTime,
  patientName,
  consultationType,
}: EmailTemplateProps) {
  return (
    <div
      style={{ fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto" }}
    >
      <h1 style={{ color: "#111111", marginBottom: "1rem" }}>
        Appointment Confirmation
      </h1>
      <p style={{ color: "#333333", lineHeight: 1.6 }}>Hello {patientName},</p>
      <p style={{ color: "#333333", lineHeight: 1.6 }}>
        {" "}
        {getConfirmationMessage(consultationType)}
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
      <p
        style={{ color: "#5E5E5E", fontSize: "0.875rem", marginTop: "1.5rem" }}
      >
        Thank you for choosing our clinic.
      </p>
    </div>
  );
}
