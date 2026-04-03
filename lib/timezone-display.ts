import { fromZonedTime } from "date-fns-tz";

/**
 * Convert a doctor-local date + time to the browser's local timezone.
 * Returns a UTC Date whose .getTime() is the true instant.
 */
export function doctorLocalToUtc(
  dateStr: string,
  timeStr: string,
  doctorTimezone: string,
): Date {
  const seconds = timeStr.length === 5 ? ":00" : "";
  return fromZonedTime(`${dateStr}T${timeStr}${seconds}`, doctorTimezone);
}

/**
 * Format a doctor-local time as a display string in the patient's browser timezone.
 * E.g. "09:00" in "America/New_York" → "7:30 PM" for a patient in "Asia/Kolkata".
 */
export function formatTimeInPatientTz(
  dateStr: string,
  timeStr: string,
  doctorTimezone: string,
): string {
  const utcDate = doctorLocalToUtc(dateStr, timeStr, doctorTimezone);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(utcDate);
}

/**
 * Format a doctor-local date as a display string in the patient's browser timezone.
 * The date may differ from the stored date if the conversion crosses midnight.
 * E.g. "2026-04-04" with time "23:00" in "America/New_York" → "Sat, 5 Apr 2026" in "Asia/Kolkata".
 */
export function formatDateInPatientTz(
  dateStr: string,
  timeStr: string,
  doctorTimezone: string,
): string {
  const utcDate = doctorLocalToUtc(dateStr, timeStr, doctorTimezone);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(utcDate);
}

/**
 * Check whether a doctor-local appointment time is in the past.
 */
export function isDoctorTimeInPast(
  dateStr: string,
  timeStr: string,
  doctorTimezone: string,
): boolean {
  return doctorLocalToUtc(dateStr, timeStr, doctorTimezone).getTime() <= Date.now();
}
