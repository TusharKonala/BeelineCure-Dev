/**
 * BMI from height (cm) and weight (kg). Returns null if inputs are invalid.
 */
export function computeBmi(heightCm: number, weightKg: number): number | null {
  if (
    !Number.isFinite(heightCm) ||
    !Number.isFinite(weightKg) ||
    heightCm <= 0 ||
    weightKg <= 0
  ) {
    return null;
  }
  const hM = heightCm / 100;
  return Math.round((weightKg / (hM * hM)) * 10) / 10;
}

/** Age in full years from a calendar date of birth. */
export function computeAgeYears(dateOfBirth: Date): number | null {
  const d = new Date(dateOfBirth);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}
