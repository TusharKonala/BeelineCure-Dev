"use client";

import { useCallback, useEffect, useState } from "react";
import { MontagaCapitalN } from "@/components/ui/MontagaCapitalN";
import { formatDateInDoctorTz, formatTimeInDoctorTz } from "@/lib/timezone-display";

type ConsultationType = "CLINIC" | "ONLINE";

type PrescriptionMedicine = {
  name: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string;
};

type DoctorPrescriptionItem = {
  appointmentId: string;
  patientName: string;
  date: string;
  time: string;
  timezone: string;
  consultationType: ConsultationType;
  medicines: PrescriptionMedicine[];
  generalNotes: string | null;
};

function consultationLabel(type: ConsultationType) {
  return type === "ONLINE" ? "Online" : "Clinic";
}

export default function DoctorPrescriptionsClient() {
  const [items, setItems] = useState<DoctorPrescriptionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPrescriptions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/doctor/prescriptions", { cache: "no-store" });
      if (!res.ok) {
        setError("Failed to load prescriptions.");
        return;
      }
      const data = (await res.json()) as { items?: DoctorPrescriptionItem[] };
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setError("Failed to load prescriptions.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrescriptions();
  }, [loadPrescriptions]);

  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
          Prescriptions
        </h1>
        <p className="font-montserrat text-sm text-[#5E5E5E]">
          View all prescriptions from your completed appointments.
        </p>
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border border-dashed border-[#e5e5e5] bg-[#fafafa] p-6 text-center">
          <p className="font-montserrat text-sm font-medium text-[#333333]">{error}</p>
        </div>
      ) : isLoading ? (
        <div className="mt-6 rounded-xl border border-dashed border-[#e5e5e5] bg-[#fafafa] p-6 text-center">
          <p className="font-montserrat text-sm font-medium text-[#333333]">Loading...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[#e5e5e5] bg-[#fafafa] p-6 text-center">
          <p className="font-montserrat text-sm font-medium text-[#333333]">
            No prescriptions found for completed appointments.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid w-full grid-cols-1 gap-4">
          {items.map((item) => {
            const consultation = consultationLabel(item.consultationType);
            return (
              <article
                key={item.appointmentId}
                className="rounded-xl border border-[#e5e5e5] bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-montaga text-lg font-semibold text-[#333333]">
                      <MontagaCapitalN text={item.patientName} />
                    </p>
                    <div className="mt-2 flex flex-col gap-1 font-montserrat text-sm text-[#333333] min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:items-center">
                      <span>
                        <span className="font-medium">Date:</span>{" "}
                        {formatDateInDoctorTz(item.date, item.time, item.timezone)}
                      </span>
                      <span
                        className="hidden text-[#e5e5e5] min-[400px]:mx-2 min-[400px]:inline"
                        aria-hidden
                      >
                        |
                      </span>
                      <span>
                        <span className="font-medium">Time:</span>{" "}
                        {formatTimeInDoctorTz(item.date, item.time, item.timezone)}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 font-montserrat text-xs font-medium ${
                        consultation === "Online"
                          ? "border-[#2555F3]/30 bg-[#2555F3]/10 text-[#2555F3]"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800"
                      }`}
                    >
                      {consultation}
                    </span>
                    <span className="rounded-full border border-[#2555F3]/30 bg-[#2555F3]/10 px-2.5 py-1 font-montserrat text-xs font-medium text-[#2555F3]">
                      {item.medicines.length} medicine{item.medicines.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="font-montserrat text-xs font-semibold uppercase tracking-wide text-[#5E5E5E]">
                    Medicines
                  </p>
                  <ul className="mt-2 space-y-1">
                    {item.medicines.map((medicine, idx) => (
                      <li key={`${item.appointmentId}-${medicine.name}-${idx}`}>
                        <p className="font-montserrat text-sm text-[#333333]">
                          <span className="font-medium">{medicine.name}</span> - {medicine.dosage} tabs ·{" "}
                          {medicine.frequency}x daily · {medicine.durationDays} day
                          {medicine.durationDays === 1 ? "" : "s"}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>

                {item.generalNotes && (
                  <p className="mt-3 whitespace-pre-wrap font-montserrat text-sm text-[#333333]">
                    <span className="font-medium">Notes:</span> {item.generalNotes}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
