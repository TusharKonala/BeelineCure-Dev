/**
 * Maps common symptom/search phrases → canonical specialization strings.
 * Values must match `DoctorSpecialization` / `Doctor.specialization` exactly.
 */

import type { DoctorSpecialization } from "@/lib/doctor-specializations";

/** Symptom or lay term → specialization for doctor discovery filters (40+ entries). */
export const SYMPTOM_TO_SPECIALIZATION: Record<
  string,
  DoctorSpecialization
> = {
  // Allergies / Immunology
  "allergic rash": "Allergist / Immunologist",
  "hives": "Allergist / Immunologist",
  "food allergy": "Allergist / Immunologist",
  "seasonal allergies": "Allergist / Immunologist",

  // Anesthesia (often hospitalized; surfaced for completeness)
  "pre surgery anesthesia": "Anesthesiologist",

  // Cardiology
  "chest pain": "Cardiologist",
  "palpitations": "Cardiologist",
  "heart racing": "Cardiologist",
  "high blood pressure": "Cardiologist",
  "hypertension": "Cardiologist",
  "shortness of breath with exertion": "Cardiologist",

  // Dental
  "tooth pain": "Dentist",
  "broken tooth": "Dentist",
  "tooth ache": "Dentist",
  "gum bleed": "Dentist",

  // Dermatology
  "rash on skin": "Dermatologist",
  "mole changing": "Dermatologist",
  "severe acne": "Dermatologist",
  "persistent itch": "Dermatologist",
  "hair loss scalp": "Dermatologist",

  // Endocrinology / metabolic
  "thirst excessive": "Endocrinologist",
  "frequent urination": "Endocrinologist",
  "thyroid enlarged": "Endocrinologist",
  "blood sugar spikes": "Endocrinologist",

  // ENT
  "ear ache": "ENT (Otolaryngologist)",
  "hearing loss": "ENT (Otolaryngologist)",
  "sore throat recurrent": "ENT (Otolaryngologist)",
  "blocked nose persistent": "ENT (Otolaryngologist)",
  "sinus congestion": "ENT (Otolaryngologist)",
  "vertigo": "ENT (Otolaryngologist)",
  "tinnitus": "ENT (Otolaryngologist)",
  "hoarse voice prolonged": "ENT (Otolaryngologist)",
  "nose bleed": "ENT (Otolaryngologist)",

  // Family medicine
  "cold symptoms": "Family Medicine",
  "flu body aches": "Family Medicine",

  // Gastro
  "acid reflux chronic": "Gastroenterologist",
  "vomiting blood": "Gastroenterologist",
  "abdominal cramps": "Gastroenterologist",

  // General physician
  "fever with fatigue": "General Physician",
  "general check up": "General Physician",

  // Gynecology
  "pelvic pain women": "Gynecologist",
  "irregular periods": "Gynecologist",
  "severe period pain": "Gynecologist",
  "vaginal discharge unusual": "Gynecologist",

  // Hematology
  "bruising unexplained": "Hematologist",
  "pale lethargic": "Hematologist",

  // Internal medicine
  "unexplained weight loss adult": "Internal Medicine",

  // Kidney / nephrology
  "blood in urine": "Nephrologist",
  "leg swelling ankles": "Nephrologist",

  // Neurology
  "brain fog": "Neurologist",
  "headache": "Neurologist",
  "severe headache migraine": "Neurologist",
  "seizures": "Neurologist",
  "numbness limbs": "Neurologist",
  "trouble swallowing neurologic": "Neurologist",

  // Neurosurgery
  "head injury concussion": "Neurosurgeon",
  "severe back pain numb legs": "Neurosurgeon",

  // Obstetrics
  "pregnancy nausea": "Obstetrician",
  "bleeding pregnant": "Obstetrician",

  // Oncology
  "persistent lump unexplained": "Oncologist",
  "unexplained anemia": "Oncologist",

  // Ophthalmology
  "blurred vision": "Ophthalmologist",
  "eye redness severe": "Ophthalmologist",

  // Orthopedic
  "broken bone": "Orthopedic Surgeon",
  "knee swollen": "Orthopedic Surgeon",

  // Pediatrics
  "baby fever cough": "Pediatrician",

  // Plastic surgery
  "scar correction": "Plastic Surgeon",

  // Psychiatry / mental health
  "severe anxiety": "Psychiatrist",
  "depression suicidal thoughts": "Psychiatrist",

  // Pulmonary
  "chronic cough": "Pulmonologist",
  "wheezing nightly": "Pulmonologist",

  // Radiology
  "imaging result review": "Radiologist",

  // Rheumatology
  "morning stiffness joints": "Rheumatologist",
  "lupus flare": "Rheumatologist",

  // Urology
  "painful urination": "Urologist",
  "kidney stone pain flank": "Urologist",

  // General surgery
  "lump abdomen": "General Surgeon",
};

function normalizeSpaces(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/** Alphabetical symptom keys for stable UI iteration. */
export function sortedSymptomEntries(): readonly [string, DoctorSpecialization][] {
  const entries = [...Object.entries(SYMPTOM_TO_SPECIALIZATION)];
  entries.sort(([a], [b]) => a.localeCompare(b));
  return entries;
}

/**
 * Symptoms whose lowercase label matches `normalizedQuery` substring; max `limit`.
 */
export function searchSymptoms(
  query: string,
  options?: { limit?: number },
): string[] {
  const q = normalizeSpaces(query.toLowerCase());
  const limit = options?.limit ?? 20;
  if (!q) {
    const all = sortedSymptomEntries().map(([k]) => k);
    return all.slice(0, limit);
  }

  const out: string[] = [];
  for (const symptom of sortedSymptomEntries().map(([k]) => k)) {
    if (symptom.toLowerCase().includes(q)) {
      out.push(symptom);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function specializationForSymptom(
  symptomLabel: string,
): DoctorSpecialization | undefined {
  const direct = SYMPTOM_TO_SPECIALIZATION[symptomLabel];
  if (direct) return direct;
  const key = normalizeSpaces(symptomLabel.toLowerCase());
  if (SYMPTOM_TO_SPECIALIZATION[key]) return SYMPTOM_TO_SPECIALIZATION[key];
  for (const [k, spec] of Object.entries(SYMPTOM_TO_SPECIALIZATION)) {
    if (normalizeSpaces(k.toLowerCase()) === key) return spec as DoctorSpecialization;
  }
  return undefined;
}
