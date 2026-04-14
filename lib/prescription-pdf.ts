import {
  prescriptionToPlainTextForPdf,
  type StructuredPrescription,
} from "@/lib/prescription-pdf-text";
import { formatDateInPatientTz } from "@/lib/timezone-display";

const PDF_MARGIN_X = 20;
const PDF_MAX_WIDTH = 170;
const PDF_LINE = 6;
const PDF_PAGE_BOTTOM = 285;

export type PrescriptionPdfInput = {
  doctorName: string;
  patientName: string;
  date: string;
  time: string;
  timezone: string;
  prescription: StructuredPrescription;
};

export async function downloadPrescriptionPdf(input: PrescriptionPdfInput) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const dateLabel = formatDateInPatientTz(input.date, input.time, input.timezone);
  const fileDoctorName = input.doctorName.replace(/[^a-z0-9]+/gi, "-");
  const body = prescriptionToPlainTextForPdf(input.prescription);

  let y = 20;
  doc.setFontSize(18);
  doc.text("Prescription", PDF_MARGIN_X, y);
  y += 14;

  doc.setFontSize(11);
  doc.text(`Doctor: ${input.doctorName}`, PDF_MARGIN_X, y);
  y += PDF_LINE;
  doc.text(`Patient: ${input.patientName}`, PDF_MARGIN_X, y);
  y += PDF_LINE;
  doc.text(`Date: ${dateLabel}`, PDF_MARGIN_X, y);
  y += 12;

  doc.setFontSize(12);
  doc.text("Prescription details", PDF_MARGIN_X, y);
  y += 10;

  doc.setFontSize(11);
  const paragraphs = body.split(/\n{2,}/).filter(Boolean);
  for (const para of paragraphs) {
    const logicalLines = para
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    for (const segment of logicalLines) {
      const wrapped = doc.splitTextToSize(segment, PDF_MAX_WIDTH);
      for (const line of wrapped) {
        if (y > PDF_PAGE_BOTTOM) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, PDF_MARGIN_X, y);
        y += PDF_LINE;
      }
    }
    y += 4;
  }

  doc.save(`prescription-${fileDoctorName || "doctor"}-${input.date}.pdf`);
}
