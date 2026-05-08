import { timeToMinutes } from "@/lib/time";

/** Default slot length (minutes) for new doctors and legacy code paths. */
export const DEFAULT_SLOT_DURATION_MINUTES = 30;

/** Kept for backward compatibility; prefer DEFAULT_SLOT_DURATION_MINUTES. */
export const SLOT_INTERVAL_MINUTES = DEFAULT_SLOT_DURATION_MINUTES;

export const ALLOWED_SLOT_DURATION_MINUTES = [15, 30, 45, 60] as const;
export type AllowedSlotDurationMinutes =
  (typeof ALLOWED_SLOT_DURATION_MINUTES)[number];
export type AvailabilityConsultationType = "CLINIC" | "ONLINE" | "BOTH";

/** Default window for the schedule UI (09:00–23:59 doctor-local). */
export const DEFAULT_SLOT_WINDOW_START = "09:00";
export const DEFAULT_SLOT_WINDOW_END = "23:59";

/** @deprecated Use DEFAULT_SLOT_WINDOW_START */
export const CLINIC_DAY_START = DEFAULT_SLOT_WINDOW_START;
/** @deprecated Use DEFAULT_SLOT_WINDOW_END */
export const CLINIC_DAY_END = DEFAULT_SLOT_WINDOW_END;

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Slot start times between [startTime, endTime), stepping by intervalMinutes
 * (same semantics as public booking slots API).
 *
 * `endTime` is an **exclusive** boundary: a slot is included only if it lies
 * fully inside the window. The effective end is snapped **down** to the
 * previous `intervalMinutes` grid mark so we never widen the window (e.g.
 * ceiling 16:00 to 16:30 for 45‑minute steps would wrongly allow 15:45).
 */
export function generateSlots(
  startTime: string,
  endTime: string,
  intervalMinutes: number,
): string[] {
  const start = timeToMinutes(startTime);
  const rawEnd = timeToMinutes(endTime);
  const end = Math.floor(rawEnd / intervalMinutes) * intervalMinutes;
  if (start >= end) return [];
  const slots: string[] = [];
  for (let t = start; t + intervalMinutes <= end; t += intervalMinutes) {
    slots.push(minutesToTime(t));
  }
  return slots;
}

/**
 * Snap window start to the next slot grid boundary for the given duration,
 * capped at the last valid start time that day.
 */
export function alignWindowStartToSlotGrid(
  time: string,
  intervalMinutes: number,
): string {
  const m = timeToMinutes(time);
  const c = Math.ceil(m / intervalMinutes) * intervalMinutes;
  const maxStart = 24 * 60 - intervalMinutes;
  const capped = Math.min(c, maxStart);
  return minutesToTime(capped);
}

/**
 * Snap exclusive window end **down** to the slot grid so we never extend the
 * window past what the user chose (ceil would add phantom time at the end).
 */
export function alignWindowEndExclusiveToSlotGrid(
  time: string,
  intervalMinutes: number,
): string {
  const m = timeToMinutes(time);
  const floored = Math.floor(m / intervalMinutes) * intervalMinutes;
  const capped = Math.min(floored, 24 * 60);
  return minutesToTime(capped);
}

const HHMM = /^\d{2}:\d{2}$/;

/**
 * True if `time` is a valid slot start on the grid for `durationMinutes`
 * (e.g. 15 → :00,:15,:30,:45; 30 → :00,:30).
 */
export function isValidSlotStartForDuration(
  time: string,
  durationMinutes: number,
): boolean {
  if (!HHMM.test(time)) return false;
  const m = timeToMinutes(time);
  if (m % durationMinutes !== 0) return false;
  if (m < 0 || m > 24 * 60 - durationMinutes) return false;
  return true;
}

/** @deprecated Use isValidSlotStartForDuration(time, 30) */
export function isValidThirtyMinuteSlotStart(time: string): boolean {
  return isValidSlotStartForDuration(time, 30);
}

/** Coerce a stored minute value to an allowed slot length (for API / DB fallbacks). */
export function coerceAllowedSlotDurationMinutes(
  n: number,
): AllowedSlotDurationMinutes {
  return ALLOWED_SLOT_DURATION_MINUTES.includes(n as AllowedSlotDurationMinutes)
    ? (n as AllowedSlotDurationMinutes)
    : DEFAULT_SLOT_DURATION_MINUTES;
}

/**
 * Infer slot length from persisted rows using the stored per-row duration.
 * Returns `fallback` when there are no rows or durations are mixed.
 */
export function inferSlotDurationMinutesFromRows(
  rows: { startTime: string; endTime: string; slotDurationMinutes?: number }[],
  fallback: AllowedSlotDurationMinutes,
): AllowedSlotDurationMinutes {
  if (rows.length === 0) return fallback;
  const durations = rows.map((r) =>
    coerceAllowedSlotDurationMinutes(r.slotDurationMinutes ?? fallback),
  );
  const first = durations[0]!;
  if (!durations.every((d) => d === first)) return fallback;
  return first;
}

/**
 * Slot starts from persisted rows using each row's stored duration.
 * Falls back to `fallbackIntervalMinutes` only for malformed/legacy rows.
 */
export function expandAvailabilityRows(
  rows: {
    id?: string;
    startTime: string;
    endTime: string;
    slotDurationMinutes?: number;
    consultationType?: AvailabilityConsultationType;
  }[],
  fallbackIntervalMinutes: number,
): string[] {
  return expandAvailabilityRowsDetailed(rows, fallbackIntervalMinutes).map(
    (slot) => slot.startTime,
  );
}

type ExpandedAvailabilitySlot = {
  startTime: string;
  slotDurationMinutes: AllowedSlotDurationMinutes;
  consultationType: AvailabilityConsultationType;
  availabilityId: string | null;
};

export function expandAvailabilityRowsDetailed(
  rows: {
    id?: string;
    startTime: string;
    endTime: string;
    slotDurationMinutes?: number;
    consultationType?: AvailabilityConsultationType;
  }[],
  fallbackIntervalMinutes: number,
): ExpandedAvailabilitySlot[] {
  const fallback = coerceAllowedSlotDurationMinutes(fallbackIntervalMinutes);
  const details = new Map<string, ExpandedAvailabilitySlot>();
  for (const row of rows) {
    const interval = coerceAllowedSlotDurationMinutes(
      row.slotDurationMinutes ?? fallback,
    );
    const consultationType = row.consultationType ?? "BOTH";
    const startTime = row.startTime;
    // One availability row represents one slot start.
    if (details.has(startTime)) continue;
    details.set(startTime, {
      startTime,
      slotDurationMinutes: interval,
      consultationType,
      availabilityId: row.id ?? null,
    });
  }
  return [...details.keys()]
    .sort()
    .map((startTime) => details.get(startTime))
    .filter((slot): slot is ExpandedAvailabilitySlot => Boolean(slot));
}

/**
 * Resolves the duration for a specific slot start from persisted availability
 * rows. Returns null when the slot is not present in availability for that date.
 */
export function resolveSlotDurationForStart(
  rows: {
    id?: string;
    startTime: string;
    endTime: string;
    slotDurationMinutes?: number;
    consultationType?: AvailabilityConsultationType;
  }[],
  slotStart: string,
  fallbackIntervalMinutes: number,
): AllowedSlotDurationMinutes | null {
  const slotMeta = resolveSlotMetaForStart(
    rows,
    slotStart,
    fallbackIntervalMinutes,
  );
  return slotMeta?.slotDurationMinutes ?? null;
}

export function resolveSlotMetaForStart(
  rows: {
    id?: string;
    startTime: string;
    endTime: string;
    slotDurationMinutes?: number;
    consultationType?: AvailabilityConsultationType;
  }[],
  slotStart: string,
  fallbackIntervalMinutes: number,
):
  | {
      slotDurationMinutes: AllowedSlotDurationMinutes;
      consultationType: AvailabilityConsultationType;
      availabilityId: string | null;
    }
  | null {
  const fallback = coerceAllowedSlotDurationMinutes(fallbackIntervalMinutes);
  const row = rows.find((candidate) => candidate.startTime === slotStart);
  if (!row) return null;
  return {
    slotDurationMinutes: coerceAllowedSlotDurationMinutes(
      row.slotDurationMinutes ?? fallback,
    ),
    consultationType: row.consultationType ?? "BOTH",
    availabilityId: row.id ?? null,
  };
}

/** End time for one bookable block starting at HH:mm. */
export function slotEndFromStart(
  startTime: string,
  durationMinutes: number,
): string {
  return minutesToTime(timeToMinutes(startTime) + durationMinutes);
}
