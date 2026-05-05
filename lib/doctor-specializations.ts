/**
 * Canonical list of doctor specializations the platform supports. Used by:
 *   - Doctor signup form (frontend `<select>`)
 *   - Doctor settings (edit profile) form
 *   - Doctor signup API (Zod enum validation)
 *   - Doctor settings API (Zod enum validation)
 *
 * The list is intentionally sorted alphabetically so the dropdown is easy to
 * scan. Add new entries to the bottom of the conceptual group, then sort.
 *
 * NOTE: Values are stored as-is on `Doctor.specialization`. Renaming a value
 * requires a backfill migration; prefer adding new values over renaming.
 */
export const DOCTOR_SPECIALIZATIONS = [
  "Allergist / Immunologist",
  "Anesthesiologist",
  "Cardiologist",
  "Dentist",
  "Dermatologist",
  "Endocrinologist",
  "ENT (Otolaryngologist)",
  "Family Medicine",
  "Gastroenterologist",
  "General Physician",
  "Gynecologist",
  "Hematologist",
  "Internal Medicine",
  "Nephrologist",
  "Neurologist",
  "Neurosurgeon",
  "Obstetrician",
  "Oncologist",
  "Ophthalmologist",
  "Orthopedic Surgeon",
  "Pediatrician",
  "Plastic Surgeon",
  "Psychiatrist",
  "Pulmonologist",
  "Radiologist",
  "Rheumatologist",
  "Urologist",
  "General Surgeon",
  "Other",
] as const;

export type DoctorSpecialization = (typeof DOCTOR_SPECIALIZATIONS)[number];

export function isDoctorSpecialization(
  value: unknown,
): value is DoctorSpecialization {
  return (
    typeof value === "string" &&
    (DOCTOR_SPECIALIZATIONS as readonly string[]).includes(value)
  );
}
