import { fromZonedTime } from "date-fns-tz";

/** 24h before appointment start in UTC ms, using patient-local date/time + IANA timezone. */
export function reminderAtMsFromPatientLocal(
  dateParam: string,
  time: string,
  timeZone: string,
): number {
  const utcDate = fromZonedTime(`${dateParam}T${time}:00`, timeZone);
  return utcDate.getTime() - 24 * 60 * 60 * 1000;
}
