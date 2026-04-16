"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createPrescriptionPdfBlobUrl, downloadPrescriptionPdf } from "@/lib/prescription-pdf";
import { type StructuredPrescription } from "@/lib/prescription-pdf-text";

type PrescriptionPreviewClientProps = {
  doctorName: string;
  patientName: string;
  date: string;
  time: string;
  timezone: string;
  prescription: {
    medicines: unknown;
    generalNotes: string | null;
  };
  backHref: string;
  backLabel?: string;
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

export function PrescriptionPreviewClient({
  doctorName,
  patientName,
  date,
  time,
  timezone,
  prescription,
  backHref,
  backLabel = "Back to appointments",
}: PrescriptionPreviewClientProps) {
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreparingPreview, setIsPreparingPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const normalizedPrescription = useMemo(
    () => normalizePrescription(prescription),
    [prescription],
  );

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function preparePreview() {
      setIsPreparingPreview(true);
      setPreviewError(null);
      try {
        const url = await createPrescriptionPdfBlobUrl({
          doctorName,
          patientName,
          date,
          time,
          timezone,
          prescription: normalizedPrescription,
        });
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setPreviewUrl(url);
      } catch {
        if (!cancelled) {
          setPreviewError("Could not render PDF preview.");
          setPreviewUrl(null);
        }
      } finally {
        if (!cancelled) {
          setIsPreparingPreview(false);
        }
      }
    }

    void preparePreview();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [doctorName, patientName, date, time, timezone, normalizedPrescription]);

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

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-[#fafafa]">
        {isPreparingPreview ? (
          <div className="p-4 font-montserrat text-sm text-[#5E5E5E]">
            Preparing prescription preview...
          </div>
        ) : previewError ? (
          <div className="p-4 font-montserrat text-sm text-red-600">{previewError}</div>
        ) : previewUrl ? (
          <iframe
            title="Prescription PDF preview"
            src={previewUrl}
            className="h-[70vh] w-full bg-white"
          />
        ) : (
          <div className="p-4 font-montserrat text-sm text-[#5E5E5E]">
            No preview available.
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer rounded-xl font-montserrat"
          onClick={() => void downloadPdf()}
          disabled={isDownloading}
        >
          {isDownloading ? "Preparing PDF..." : "Download prescription PDF"}
        </Button>
        <Button
          type="button"
          className="cursor-pointer rounded-xl font-montserrat"
          onClick={() => router.push(backHref)}
        >
          {backLabel}
        </Button>
      </div>
    </div>
  );
}
