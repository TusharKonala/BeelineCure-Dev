export function formatDoctorDisplayName(name: string | null | undefined): string {
  const trimmedName = name?.trim() ?? "";
  if (!trimmedName) return "Doctor";

  return /^dr\.?\s+/i.test(trimmedName)
    ? trimmedName.replace(/^dr\.?\s+/i, "Dr. ")
    : `Dr. ${trimmedName}`;
}
