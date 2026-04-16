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
      // #region agent log
      fetch('http://127.0.0.1:7526/ingest/93fa37b6-8a67-48a3-993f-4c2ad777ca28',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'33e6e6'},body:JSON.stringify({sessionId:'33e6e6',runId:`preview-${Date.now()}`,hypothesisId:'P1',location:'components/prescription/PrescriptionPreviewClient.tsx:81',message:'Preparing prescription preview',data:{hasWindow:typeof window!=='undefined',userAgent:typeof navigator!=='undefined'?navigator.userAgent:'unknown',medicineCount:normalizedPrescription.medicines.length,hasNotes:Boolean(normalizedPrescription.generalNotes)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
        // #region agent log
        fetch('http://127.0.0.1:7526/ingest/93fa37b6-8a67-48a3-993f-4c2ad777ca28',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'33e6e6'},body:JSON.stringify({sessionId:'33e6e6',runId:`preview-${Date.now()}`,hypothesisId:'P1',location:'components/prescription/PrescriptionPreviewClient.tsx:98',message:'Prescription preview blob URL created',data:{urlPrefix:url.slice(0,12),isBlobUrl:url.startsWith('blob:'),userAgent:typeof navigator!=='undefined'?navigator.userAgent:'unknown'},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      } catch {
        if (!cancelled) {
          setPreviewError("Could not render PDF preview.");
          setPreviewUrl(null);
          // #region agent log
          fetch('http://127.0.0.1:7526/ingest/93fa37b6-8a67-48a3-993f-4c2ad777ca28',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'33e6e6'},body:JSON.stringify({sessionId:'33e6e6',runId:`preview-${Date.now()}`,hypothesisId:'P1',location:'components/prescription/PrescriptionPreviewClient.tsx:104',message:'Prescription preview generation failed',data:{userAgent:typeof navigator!=='undefined'?navigator.userAgent:'unknown'},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
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
            onLoad={() => {
              // #region agent log
              fetch('http://127.0.0.1:7526/ingest/93fa37b6-8a67-48a3-993f-4c2ad777ca28',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'33e6e6'},body:JSON.stringify({sessionId:'33e6e6',runId:`preview-${Date.now()}`,hypothesisId:'P2',location:'components/prescription/PrescriptionPreviewClient.tsx:152',message:'Prescription preview iframe loaded',data:{userAgent:typeof navigator!=='undefined'?navigator.userAgent:'unknown',srcPrefix:previewUrl.slice(0,12)},timestamp:Date.now()})}).catch(()=>{});
              // #endregion
            }}
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
