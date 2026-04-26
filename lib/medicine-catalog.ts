import medicines from "@/lib/medicines.json";

export type MedicineSuggestion = {
  name: string;
};

const LOCAL_MEDICINES: MedicineSuggestion[] = medicines as MedicineSuggestion[];
const MAX_RESULTS = 10;

export function normalizeMedicineName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function getLocalMedicineSuggestions(query: string): MedicineSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matches: MedicineSuggestion[] = [];
  for (const medicine of LOCAL_MEDICINES) {
    if (medicine.name.toLowerCase().includes(q)) {
      matches.push({ name: medicine.name });
      if (matches.length >= MAX_RESULTS) break;
    }
  }
  return matches;
}

export function isKnownLocalMedicine(name: string): boolean {
  const normalized = normalizeMedicineName(name);
  if (!normalized) return false;
  return LOCAL_MEDICINES.some(
    (medicine) => normalizeMedicineName(medicine.name) === normalized,
  );
}
