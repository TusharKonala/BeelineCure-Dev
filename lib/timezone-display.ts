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
 * Format a doctor-local date directly for doctor-facing UI.
 * This intentionally does not convert across timezones.
 */
export function formatDateInDoctorTz(
  dateStr: string,
  timeStr: string,
  doctorTimezone: string,
): string {
  void timeStr;
  void doctorTimezone;
  const [y, m, d] = dateStr.split("-").map((part) => Number(part));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return dateStr;
  }

  // Use UTC to preserve the exact calendar date label without timezone shifts.
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
}

/**
 * Format a doctor-local time directly for doctor-facing UI.
 * This intentionally does not convert across timezones.
 */
export function formatTimeInDoctorTz(
  _dateStr: string,
  timeStr: string,
  doctorTimezone: string,
): string {
  void doctorTimezone;
  const [hourRaw, minuteRaw] = timeStr.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return timeStr;
  }

  const normalizedHour = ((hour % 24) + 24) % 24;
  const period = normalizedHour >= 12 ? "PM" : "AM";
  const hour12 = normalizedHour % 12 || 12;
  const minuteLabel = String(minute).padStart(2, "0");
  return `${hour12}:${minuteLabel} ${period}`;
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
