/**
 * Normalizes stored prescription content for PDF output.
 * Plain text is returned as-is; HTML from a future rich-text editor is converted
 * to readable plain text (structure preserved via line breaks).
 */
export function prescriptionToPlainTextForPdf(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(trimmed);
  if (!looksLikeHtml) {
    return trimmed;
  }

  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(
        `<div class="rx-root">${trimmed}</div>`,
        "text/html",
      );
      const root = doc.querySelector(".rx-root");
      if (root) {
        return root.innerText
          .replace(/\r\n/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
      }
    } catch {
      // fall through to regex fallback
    }
  }

  return trimmed
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr)>/gi, "\n\n")
    .replace(/<\/(li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
