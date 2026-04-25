/**
 * OpenFDA drug label search helper used by the doctor prescription form for
 * medicine name suggestions. The API is a public, unauthenticated, read-only
 * endpoint provided by the U.S. Food and Drug Administration.
 *
 * Docs: https://open.fda.gov/apis/drug/label/
 */

const OPENFDA_BASE = "https://api.fda.gov/drug/label.json";

type OpenFdaLabelResult = {
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
  };
};

type OpenFdaResponse = {
  results?: OpenFdaLabelResult[];
};

/**
 * Returns up to ~10 distinct medicine name suggestions matching `query`.
 * The query is matched as a prefix against both brand and generic names.
 *
 * Resolves to an empty array on any error (network, rate limit, malformed
 * response). The form falls back to plain text input when this happens, so
 * suggestion failures must never block typing.
 */
export async function searchMedicineNames(
  query: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  // OpenFDA full-text search syntax: field:value*. We must escape characters
  // with special meaning in Lucene queries to avoid 400s on inputs like
  // "vitamin-c" or "amox+".
  const escaped = trimmed.replace(/[\\+\-!(){}\[\]^"~*?:]/g, "\\$&");
  const searchExpr = `openfda.brand_name:${escaped}*+OR+openfda.generic_name:${escaped}*`;
  const url = `${OPENFDA_BASE}?search=${encodeURIComponent(searchExpr).replace(/%2B/g, "+")}&limit=10`;

  try {
    const res = await fetch(url, { signal, cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as OpenFdaResponse;
    const results = Array.isArray(data.results) ? data.results : [];
    const lowerQuery = trimmed.toLowerCase();
    const seen = new Set<string>();
    const suggestions: string[] = [];
    for (const result of results) {
      const candidates = [
        ...(result.openfda?.brand_name ?? []),
        ...(result.openfda?.generic_name ?? []),
      ];
      for (const raw of candidates) {
        const name = raw.trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        if (!key.startsWith(lowerQuery) && !key.includes(lowerQuery)) continue;
        seen.add(key);
        suggestions.push(name);
        if (suggestions.length >= 10) return suggestions;
      }
    }
    return suggestions;
  } catch {
    return [];
  }
}
