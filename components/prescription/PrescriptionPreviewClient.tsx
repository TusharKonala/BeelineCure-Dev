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
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [isMobilePreviewFallback, setIsMobilePreviewFallback] = useState(false);
  const normalizedPrescription = useMemo(
    () => normalizePrescription(prescription),
    [prescription],
  );

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent || "";
    setIsMobilePreviewFallback(/Android|iPhone|iPad|iPod|Mobile/i.test(ua));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function preparePreview() {
      setIsPreparingPreview(true);
      setPreviewError(null);
      setIframeLoaded(false);
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
          isMobilePreviewFallback ? (
            <div className="space-y-4 bg-white p-4">
              <div className="rounded-lg border border-[#e5e5e5] bg-[#fcfcfc] p-4">
                <p className="font-montserrat text-sm font-semibold text-[#333333]">
                  Mobile preview
                </p>
                <p className="mt-1 font-montserrat text-sm text-[#5E5E5E]">
                  Your browser does not reliably render the inline PDF preview on mobile, so
                  showing the prescription details directly here instead.
                </p>
              </div>
              <div className="space-y-2 font-montserrat text-sm text-[#333333]">
                <p>
                  <span className="font-semibold">Doctor:</span> {doctorName}
                </p>
                <p>
                  <span className="font-semibold">Patient:</span> {patientName}
                </p>
                <p>
                  <span className="font-semibold">Date:</span> {date}
                </p>
              </div>
              <div className="space-y-3">
                {normalizedPrescription.medicines.map((medicine, index) => (
                  <div
                    key={`${medicine.name}-${index}`}
                    className="rounded-lg border border-[#e5e5e5] bg-[#fcfcfc] p-4"
                  >
                    <p className="font-montserrat text-sm font-semibold text-[#333333]">
                      {medicine.name}
                    </p>
                    <p className="mt-1 font-montserrat text-sm text-[#5E5E5E]">
                      {medicine.dosage} | {medicine.frequency} | {medicine.durationDays} day
                      {medicine.durationDays === 1 ? "" : "s"}
                    </p>
                    <p className="mt-2 font-montserrat text-sm text-[#333333]">
                      {medicine.instructions}
                    </p>
                  </div>
                ))}
                {normalizedPrescription.generalNotes && (
                  <div className="rounded-lg border border-[#e5e5e5] bg-[#fcfcfc] p-4">
                    <p className="font-montserrat text-sm font-semibold text-[#333333]">
                      General notes
                    </p>
                    <p className="mt-2 whitespace-pre-wrap font-montserrat text-sm text-[#333333]">
                      {normalizedPrescription.generalNotes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <iframe
              title="Prescription PDF preview"
              src={previewUrl}
              className="h-[70vh] w-full bg-white"
              onLoad={() => {
                setIframeLoaded(true);
                // #region agent log
                fetch('http://127.0.0.1:7526/ingest/93fa37b6-8a67-48a3-993f-4c2ad777ca28',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'33e6e6'},body:JSON.stringify({sessionId:'33e6e6',runId:`preview-${Date.now()}`,hypothesisId:'P2',location:'components/prescription/PrescriptionPreviewClient.tsx:152',message:'Prescription preview iframe loaded',data:{userAgent:typeof navigator!=='undefined'?navigator.userAgent:'unknown',srcPrefix:previewUrl.slice(0,12)},timestamp:Date.now()})}).catch(()=>{});
                // #endregion
              }}
            />
          )
        ) : (
          <div className="p-4 font-montserrat text-sm text-[#5E5E5E]">
            No preview available.
          </div>
        )}
      </div>
      <div className="rounded-xl border border-dashed border-[#e5e5e5] bg-[#fcfcfc] p-3 font-montserrat text-xs text-[#5E5E5E]">
        <p>Preview debug:</p>
        <p>{isPreparingPreview ? "Generating PDF..." : "PDF generation finished."}</p>
        <p>{previewError ? `Error: ${previewError}` : "No generation error."}</p>
        <p>{previewUrl ? "Blob preview URL created." : "No blob preview URL."}</p>
        <p>{iframeLoaded ? "Preview frame loaded." : "Preview frame not loaded yet."}</p>
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
        {previewUrl && isMobilePreviewFallback && (
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer rounded-xl font-montserrat"
            onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
          >
            Open PDF
          </Button>
        )}
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
