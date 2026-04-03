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
 * Format a doctor-local time as a display string in the patient's timezone.
 * On the client, omit `patientTimezone` to use the browser default.
 * On the server (emails), pass it explicitly.
 */
export function formatTimeInPatientTz(
  dateStr: string,
  timeStr: string,
  doctorTimezone: string,
  patientTimezone?: string,
): string {
  const utcDate = doctorLocalToUtc(dateStr, timeStr, doctorTimezone);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...(patientTimezone ? { timeZone: patientTimezone } : {}),
  }).format(utcDate);
}

/**
 * Format a doctor-local date as a display string in the patient's timezone.
 * On the client, omit `patientTimezone` to use the browser default.
 * On the server (emails), pass it explicitly.
 */
export function formatDateInPatientTz(
  dateStr: string,
  timeStr: string,
  doctorTimezone: string,
  patientTimezone?: string,
): string {
  const utcDate = doctorLocalToUtc(dateStr, timeStr, doctorTimezone);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(patientTimezone ? { timeZone: patientTimezone } : {}),
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
