export type LocalMedicineSuggestion = {
  name: string;
};

export async function searchMedicineNames(
  query: string,
  signal?: AbortSignal,
): Promise<LocalMedicineSuggestion[]> {
  if (signal?.aborted) return [];
  const trimmed = query.trim();
  if (!trimmed) return [];
  try {
    const res = await fetch(
      `/api/doctor/medicine-search?query=${encodeURIComponent(trimmed)}`,
      {
        signal,
        cache: "no-store",
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { suggestions?: LocalMedicineSuggestion[] };
    return Array.isArray(data.suggestions) ? data.suggestions : [];
  } catch {
    return [];
  }
}
