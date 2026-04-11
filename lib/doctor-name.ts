export function formatDoctorDisplayName(name: string | null | undefined): string {
  const trimmedName = name?.trim() ?? "";
  if (!trimmedName) return "Doctor";

  return /^dr\.?\s+/i.test(trimmedName)
    ? trimmedName.replace(/^dr\.?\s+/i, "Dr. ")
    : `Dr. ${trimmedName}`;
}

/**
 * Canonical persisted doctor name (e.g. signup): same rules as {@link formatDoctorDisplayName},
 * using `fallbackLocalPart` (typically email local part) when `name` is empty.
 */
export function formatDoctorStoredName(
  name: string | undefined,
  fallbackLocalPart: string,
): string {
  const raw = (name?.trim() || fallbackLocalPart.trim() || "Doctor").trim();
  return formatDoctorDisplayName(raw);
}
