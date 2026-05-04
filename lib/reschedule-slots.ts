import { coerceAllowedSlotDurationMinutes } from "@/lib/doctor-availability-slots";
import { isDoctorTimeInPast } from "@/lib/timezone-display";

export type RescheduleSlotDetail = {
  startTime: string;
  slotDurationMinutes: number;
};

/**
 * Slot starts that match the originally booked duration, excluding times already past in the doctor's timezone.
 */
export function filterReschedulableSlots(args: {
  slotDetails: RescheduleSlotDetail[];
  bookedDurationMinutes: number;
  selectedDate: string;
  doctorTimezone: string;
}): string[] {
  const booked = coerceAllowedSlotDurationMinutes(args.bookedDurationMinutes);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const detail of args.slotDetails) {
    if (detail.slotDurationMinutes !== booked) continue;
    if (seen.has(detail.startTime)) continue;
    if (isDoctorTimeInPast(args.selectedDate, detail.startTime, args.doctorTimezone)) {
      continue;
    }
    seen.add(detail.startTime);
    out.push(detail.startTime);
  }
  return out.sort();
}
