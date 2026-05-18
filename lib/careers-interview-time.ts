import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/** IANA timezones offered in the schedule-interview form (aligned with doctor settings). */
export const INTERVIEW_TIMEZONE_OPTIONS = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
] as const;

export function defaultInterviewTimezone(): string {
  if (typeof Intl !== "undefined") {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  }
  return "UTC";
}

/**
 * Parse a `datetime-local` value as wall-clock time in the given IANA timezone.
 */
export function parseDatetimeLocalInTimezone(
  datetimeLocal: string,
  timezone: string,
): Date {
  const normalized = datetimeLocal.trim().replace(" ", "T");
  const withSeconds =
    normalized.length === 16 ? `${normalized}:00` : normalized;
  return fromZonedTime(withSeconds, timezone);
}

function formatInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: "short",
  }).format(date);
}

/**
 * Primary label in admin timezone; append candidate time in brackets only when TZ differs.
 */
export function formatInterviewTime(
  date: Date,
  adminTimezone: string,
  candidateTimezone?: string | null,
): string {
  const primary = formatInTimezone(date, adminTimezone);
  if (
    !candidateTimezone?.trim() ||
    candidateTimezone.trim() === adminTimezone
  ) {
    return primary;
  }
  const candidate = formatInTimezone(date, candidateTimezone.trim());
  return `${primary} (${candidate})`;
}

/** Minimum `datetime-local` string (start of today) for the given timezone. */
export function minDatetimeLocalForTimezone(timezone: string): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}T00:00`;
}

/** Format a UTC instant as `datetime-local` input value in the given timezone. */
export function formatDatetimeLocalInTimezone(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd'T'HH:mm");
}
