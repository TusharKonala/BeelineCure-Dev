"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { type StructuredPrescription } from "@/lib/prescription-pdf-text";
import { downloadPrescriptionPdf } from "@/lib/prescription-pdf";

type PrescriptionDownloadClientProps = {
  appointmentId: string;
  doctorName: string;
  patientName: string;
  date: string;
  time: string;
  timezone: string;
  prescription: {
    medicines: unknown;
    generalNotes: string | null;
  };
};

function normalizePrescription(raw: {
  medicines: unknown;
  generalNotes: string | null;
}): StructuredPrescription {
  const medicines = Array.isArray(raw.medicines)
    ? raw.medicines.filter((item) => !!item && typeof item === "object").map((item) => {
        const entry = item as Record<string, unknown>;
        return {
          name: String(entry.name ?? "").trim(),
          dosage: String(entry.dosage ?? "").trim(),
          frequency: String(entry.frequency ?? "").trim(),
          durationDays: Number(entry.durationDays ?? 0),
          instructions: String(entry.instructions ?? "").trim(),
        };
      })
    : [];
  return {
    medicines: medicines.filter(
      (m) =>
        m.name &&
        m.dosage &&
        m.frequency &&
        m.instructions &&
        Number.isInteger(m.durationDays) &&
        m.durationDays > 0,
    ),
    generalNotes: raw.generalNotes,
  };
}

export function PrescriptionDownloadClient({
  appointmentId,
  doctorName,
  patientName,
  date,
  time,
  timezone,
  prescription,
}: PrescriptionDownloadClientProps) {
  const router = useRouter();
  const [isDownloading, setIsDownloading] = useState(false);
  const normalizedPrescription = normalizePrescription(prescription);

  async function downloadPdf() {
    setIsDownloading(true);
    try {
      await downloadPrescriptionPdf({
        doctorName,
        patientName,
        date,
        time,
        timezone,
        prescription: normalizedPrescription,
      });
    } finally {
      setIsDownloading(false);
    }
  }

  useEffect(() => {
    void downloadPdf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        className="cursor-pointer rounded-xl font-montserrat"
        onClick={() => void downloadPdf()}
        disabled={isDownloading}
      >
        {isDownloading ? "Preparing PDF..." : "View prescription"}
      </Button>
      <Button
        type="button"
        className="cursor-pointer rounded-xl font-montserrat"
        onClick={() => router.push("/patient/appointments")}
      >
        Back to appointments
      </Button>
    </div>
  );
}
