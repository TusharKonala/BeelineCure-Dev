"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { MontagaCapitalN } from "@/components/ui/MontagaCapitalN";
import { computeAgeYears } from "@/lib/health-profile-metrics";
import { formatDateInDoctorTz, formatTimeInDoctorTz } from "@/lib/timezone-display";

type ConsultationType = "CLINIC" | "ONLINE";
type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

type HealthProfileDto = {
  id: string;
  bloodGroup: string | null;
  heightCm: number | null;
  weightKg: number | null;
  dateOfBirth: string | null;
  gender: string | null;
  allergies: string | null;
  conditions: string | null;
  currentMedications: string | null;
  pastSurgeries: string | null;
  smokingStatus: string | null;
  alcoholUse: string | null;
  activityLevel: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  emergencyContact2Name: string | null;
  emergencyContact2Phone: string | null;
  emergencyContact2Relationship: string | null;
};

type PatientSummary = {
  patientName: string;
  email: string;
  phone: string;
  appointmentCount: number;
};

type LastAppointment = {
  id: string;
  date: string;
  time: string;
  timezone: string;
  consultationType: ConsultationType;
  status: AppointmentStatus;
  notes: string | null;
};

type LastPrescription = {
  appointmentId: string;
  date: string;
  time: string;
  timezone: string;
  consultationType: ConsultationType;
  medicinesCount: number;
  generalNotes: string | null;
};

type DetailResponse = {
  patient: PatientSummary;
  healthProfile: HealthProfileDto | null;
  lastAppointment: LastAppointment | null;
  lastPrescription: LastPrescription | null;
};

type Props = {
  patientEmail: string;
};

function valueOrDash(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function emergencyLine(
  name: string | null | undefined,
  relationship: string | null | undefined,
  phone: string | null | undefined,
): string {
  const parts = [name, relationship, phone].map((part) => part?.trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function consultationLabel(type: ConsultationType): string {
  return type === "ONLINE" ? "Online" : "Clinic";
}

function statusLabel(status: AppointmentStatus): string {
  if (status === "PENDING") return "Pending";
  if (status === "CONFIRMED") return "Confirmed";
  if (status === "COMPLETED") return "Completed";
  return "Cancelled";
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[#f0f0f0] py-3 last:border-b-0">
      <p className="font-montserrat text-xs font-medium uppercase tracking-wide text-[#5E5E5E]">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap font-montserrat text-sm text-[#333333]">{value}</p>
    </div>
  );
}

export default function DoctorPatientDetailClient({ patientEmail }: Props) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPatientDetails() {
      setIsLoading(true);
      setError(null);
      try {
        const decodedEmail = decodeURIComponent(patientEmail);
        const res = await fetch(`/api/doctor/patients/${encodeURIComponent(decodedEmail)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (cancelled) return;
          setError("Failed to load patient details.");
          return;
        }
        const payload = (await res.json()) as DetailResponse;
        if (cancelled) return;
        setData(payload);
      } catch {
        if (cancelled) return;
        setError("Failed to load patient details.");
      } finally {
        if (cancelled) return;
        setIsLoading(false);
      }
    }

    void loadPatientDetails();

    return () => {
      cancelled = true;
    };
  }, [patientEmail]);

  const profile = data?.healthProfile ?? null;
  const age = useMemo(() => {
    const dob = profile?.dateOfBirth;
    if (!dob) return null;
    const computed = computeAgeYears(new Date(dob));
    return computed == null ? null : `${computed} years`;
  }, [profile?.dateOfBirth]);

  const patientDisplayEmail = data?.patient.email ?? decodeURIComponent(patientEmail);

  if (isLoading) {
    return (
      <section className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
        <h1 className="font-montaga text-2xl font-semibold text-[#333333] md:text-3xl">Patient</h1>
        <p className="mt-2 font-montserrat text-sm text-[#5E5E5E]">Loading patient details...</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
        <h1 className="font-montaga text-2xl font-semibold text-[#333333] md:text-3xl">
          Patient unavailable
        </h1>
        <p className="mt-2 font-montserrat text-sm text-[#5E5E5E]">
          {error ?? "We could not load this patient right now. Please try again in a moment."}
        </p>
        <Link
          href="/doctor/patients"
          className="mt-4 inline-block font-montserrat text-sm font-medium text-[#2555F3] hover:underline"
        >
          Back to patients
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-montaga text-2xl font-semibold text-[#333333] md:text-3xl">
            <MontagaCapitalN text={data.patient.patientName} />
          </h1>
          <p className="mt-2 break-all font-montserrat text-sm text-[#5E5E5E]">
            {patientDisplayEmail}
          </p>
          <p className="mt-1 font-montserrat text-sm text-[#5E5E5E]">{data.patient.phone}</p>
          <p className="mt-2 font-montserrat text-sm text-[#333333]">
            {data.patient.appointmentCount} appointment
            {data.patient.appointmentCount === 1 ? "" : "s"} with you
          </p>
        </div>
        <Link
          href="/doctor/patients"
          className="w-fit font-montserrat text-sm font-medium text-[#2555F3] hover:underline"
        >
          Back to patients
        </Link>
      </div>

      <div className="mt-6 rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-5">
        <h2 className="font-montserrat text-sm font-semibold text-[#333333]">Health profile</h2>
        {profile ? (
          <div className="mt-2">
            <SummaryRow label="Blood group" value={valueOrDash(profile.bloodGroup)} />
            <SummaryRow
              label="Height / weight"
              value={
                profile.heightCm != null || profile.weightKg != null
                  ? [
                      profile.heightCm != null ? `${profile.heightCm} cm` : null,
                      profile.weightKg != null ? `${profile.weightKg} kg` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "—"
              }
            />
            <SummaryRow
              label="Date of birth"
              value={profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : "—"}
            />
            <SummaryRow label="Age" value={age ?? "—"} />
            <SummaryRow label="Gender" value={valueOrDash(profile.gender)} />
            <SummaryRow label="Allergies" value={valueOrDash(profile.allergies)} />
            <SummaryRow label="Chronic conditions" value={valueOrDash(profile.conditions)} />
            <SummaryRow
              label="Current medications"
              value={valueOrDash(profile.currentMedications)}
            />
            <SummaryRow label="Past surgeries" value={valueOrDash(profile.pastSurgeries)} />
            <SummaryRow label="Smoking status" value={valueOrDash(profile.smokingStatus)} />
            <SummaryRow label="Alcohol use" value={valueOrDash(profile.alcoholUse)} />
            <SummaryRow label="Activity level" value={valueOrDash(profile.activityLevel)} />
            <SummaryRow
              label="Primary emergency contact"
              value={emergencyLine(
                profile.emergencyContactName,
                profile.emergencyContactRelationship,
                profile.emergencyContactPhone,
              )}
            />
            <SummaryRow
              label="Secondary emergency contact"
              value={emergencyLine(
                profile.emergencyContact2Name,
                profile.emergencyContact2Relationship,
                profile.emergencyContact2Phone,
              )}
            />
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-[#e5e5e5] bg-white p-4">
            <p className="font-montserrat text-sm text-[#5E5E5E]">
              No health profile available yet.
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-5">
          <h3 className="font-montserrat text-sm font-semibold text-[#333333]">Last appointment</h3>
          {data.lastAppointment ? (
            <>
              <div className="mt-2 space-y-1 font-montserrat text-sm text-[#333333]">
                <p>
                  <span className="font-medium">Date:</span>{" "}
                  {formatDateInDoctorTz(
                    data.lastAppointment.date,
                    data.lastAppointment.time,
                    data.lastAppointment.timezone,
                  )}
                </p>
                <p>
                  <span className="font-medium">Time:</span>{" "}
                  {formatTimeInDoctorTz(
                    data.lastAppointment.date,
                    data.lastAppointment.time,
                    data.lastAppointment.timezone,
                  )}
                </p>
                <p>
                  <span className="font-medium">Consultation:</span>{" "}
                  {consultationLabel(data.lastAppointment.consultationType)}
                </p>
                <p>
                  <span className="font-medium">Status:</span> {statusLabel(data.lastAppointment.status)}
                </p>
                <p className="whitespace-pre-wrap text-[#5E5E5E]">
                  <span className="font-medium text-[#333333]">Notes:</span>{" "}
                  {valueOrDash(data.lastAppointment.notes)}
                </p>
              </div>
              <Button asChild size="sm" className="mt-4 w-fit cursor-pointer rounded-xl font-montserrat">
                <Link href={`/doctor/appointments?search=${encodeURIComponent(patientDisplayEmail)}`}>
                  View all appointments
                </Link>
              </Button>
            </>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-[#e5e5e5] bg-white p-4">
              <p className="font-montserrat text-sm text-[#5E5E5E]">No appointment found yet.</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-5">
          <h3 className="font-montserrat text-sm font-semibold text-[#333333]">Last prescription</h3>
          {data.lastPrescription ? (
            <>
              <div className="mt-2 space-y-1 font-montserrat text-sm text-[#333333]">
                <p>
                  <span className="font-medium">Date:</span>{" "}
                  {formatDateInDoctorTz(
                    data.lastPrescription.date,
                    data.lastPrescription.time,
                    data.lastPrescription.timezone,
                  )}
                </p>
                <p>
                  <span className="font-medium">Time:</span>{" "}
                  {formatTimeInDoctorTz(
                    data.lastPrescription.date,
                    data.lastPrescription.time,
                    data.lastPrescription.timezone,
                  )}
                </p>
                <p>
                  <span className="font-medium">Consultation:</span>{" "}
                  {consultationLabel(data.lastPrescription.consultationType)}
                </p>
                <p>
                  <span className="font-medium">Medicines:</span> {data.lastPrescription.medicinesCount}
                </p>
                <p className="whitespace-pre-wrap text-[#5E5E5E]">
                  <span className="font-medium text-[#333333]">Notes:</span>{" "}
                  {valueOrDash(data.lastPrescription.generalNotes)}
                </p>
              </div>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="mt-4 w-fit cursor-pointer rounded-xl border-2 border-[#b8b8b8] font-montserrat hover:border-[#8a8a8a]"
              >
                <Link href={`/doctor/prescriptions?search=${encodeURIComponent(patientDisplayEmail)}`}>
                  View all prescriptions
                </Link>
              </Button>
            </>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-[#e5e5e5] bg-white p-4">
              <p className="font-montserrat text-sm text-[#5E5E5E]">No prescription found yet.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
