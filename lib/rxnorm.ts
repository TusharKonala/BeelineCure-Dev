const RXNORM_BASE_URL = "https://rxnav.nlm.nih.gov/REST/drugs.json";

export type RxNormSuggestion = {
  rxcui: string;
  displayName: string;
  synonym: string;
};

type RxNormConceptProperty = {
  rxcui?: string;
  name?: string;
  synonym?: string;
};

type RxNormGroup = {
  conceptProperties?: RxNormConceptProperty[];
};

type RxNormResponse = {
  drugGroup?: {
    conceptGroup?: RxNormGroup[];
  };
};

export async function searchMedicineNames(
  query: string,
  signal?: AbortSignal,
): Promise<RxNormSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = `${RXNORM_BASE_URL}?name=${encodeURIComponent(trimmed)}`;
  try {
    const res = await fetch(url, { signal, cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as RxNormResponse;
    const groups = data.drugGroup?.conceptGroup ?? [];
    const seen = new Set<string>();
    const suggestions: RxNormSuggestion[] = [];
    for (const group of groups) {
      for (const concept of group.conceptProperties ?? []) {
        const rxcui = concept.rxcui?.trim() ?? "";
        const displayName = concept.name?.trim() ?? "";
        const synonym = (concept.synonym?.trim() || displayName).trim();
        if (!rxcui || !displayName) continue;
        if (seen.has(rxcui)) continue;
        seen.add(rxcui);
        suggestions.push({ rxcui, displayName, synonym });
        if (suggestions.length >= 12) return suggestions;
      }
    }
    return suggestions;
  } catch {
    return [];
  }
}
