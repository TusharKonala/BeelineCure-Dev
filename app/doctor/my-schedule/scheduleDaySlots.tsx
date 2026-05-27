"use client";

export type SlotDetail = {
  startTime: string;
  consultationType: "CLINIC" | "ONLINE" | "BOTH";
  booked: boolean;
  slotDurationMinutes: number;
};

export type ScheduleListDay = {
  date: string;
  slotStarts: string[];
  slotDetails?: SlotDetail[];
};

export function bookedConsultationAbbrev(
  type: SlotDetail["consultationType"],
): string {
  if (type === "CLINIC") return "(C)";
  if (type === "ONLINE") return "(O)";
  return "(C/O)";
}

/** Lexicographic sort works for "HH:MM" / "H:MM" style slot starts used in scheduling. */
export function compareSlotStart(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

export function normalizeDaySlots(day: ScheduleListDay): SlotDetail[] {
  return (
    day.slotDetails ??
    day.slotStarts.map((startTime) => ({
      startTime,
      consultationType: "BOTH" as const,
      booked: false,
      slotDurationMinutes: 30,
    }))
  );
}

export function groupScheduleDaySlots(slots: SlotDetail[]) {
  const clinicOnlyAvail: string[] = [];
  const onlineOnlyAvail: string[] = [];
  const clinicOnlineAvail: string[] = [];
  const booked: { startTime: string; consultationType: SlotDetail["consultationType"] }[] =
    [];

  for (const s of slots) {
    if (s.booked) {
      booked.push({
        startTime: s.startTime,
        consultationType: s.consultationType,
      });
      continue;
    }
    if (s.consultationType === "CLINIC") clinicOnlyAvail.push(s.startTime);
    else if (s.consultationType === "ONLINE") onlineOnlyAvail.push(s.startTime);
    else clinicOnlineAvail.push(s.startTime);
  }

  clinicOnlyAvail.sort(compareSlotStart);
  onlineOnlyAvail.sort(compareSlotStart);
  clinicOnlineAvail.sort(compareSlotStart);
  booked.sort((x, y) => compareSlotStart(x.startTime, y.startTime));

  return { clinicOnlyAvail, onlineOnlyAvail, clinicOnlineAvail, booked };
}

type DurationBucket = {
  durationMinutes: number;
  startTimes: string[];
};

type ConsultationTypeGroup = {
  consultationType: SlotDetail["consultationType"];
  label: string;
  durations: DurationBucket[];
};

type BookedSlot = {
  startTime: string;
  consultationType: SlotDetail["consultationType"];
  slotDurationMinutes: number;
};

export type GroupedSlotSummary = {
  available: ConsultationTypeGroup[];
  booked: BookedSlot[];
  hasMixedDurations: boolean;
};

const CONSULT_TYPE_ORDER: SlotDetail["consultationType"][] = ["CLINIC", "ONLINE", "BOTH"];
const CONSULT_TYPE_LABEL: Record<SlotDetail["consultationType"], string> = {
  CLINIC: "Clinic",
  ONLINE: "Online",
  BOTH: "Clinic/Online",
};

export function groupSlotsByTypeAndDuration(slots: SlotDetail[]): GroupedSlotSummary {
  const booked: BookedSlot[] = [];
  const byType = new Map<
    SlotDetail["consultationType"],
    Map<number, string[]>
  >();

  const allDurations = new Set<number>();

  for (const s of slots) {
    allDurations.add(s.slotDurationMinutes);
    if (s.booked) {
      booked.push({
        startTime: s.startTime,
        consultationType: s.consultationType,
        slotDurationMinutes: s.slotDurationMinutes,
      });
      continue;
    }
    let durMap = byType.get(s.consultationType);
    if (!durMap) {
      durMap = new Map();
      byType.set(s.consultationType, durMap);
    }
    const list = durMap.get(s.slotDurationMinutes) ?? [];
    list.push(s.startTime);
    durMap.set(s.slotDurationMinutes, list);
  }

  booked.sort((a, b) => compareSlotStart(a.startTime, b.startTime));
  const hasMixedDurations = allDurations.size > 1;

  const available: ConsultationTypeGroup[] = [];
  for (const ct of CONSULT_TYPE_ORDER) {
    const durMap = byType.get(ct);
    if (!durMap || durMap.size === 0) continue;
    const durations: DurationBucket[] = [...durMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([dur, times]) => ({
        durationMinutes: dur,
        startTimes: times.sort(compareSlotStart),
      }));
    available.push({
      consultationType: ct,
      label: CONSULT_TYPE_LABEL[ct],
      durations,
    });
  }

  return { available, booked, hasMixedDurations };
}

type SlotSummaryFromDetailsProps = {
  slots: SlotDetail[];
  /** When true, only render the "Booked" line — used by the Booked-only filter on View Schedule. */
  bookedOnly?: boolean;
};

export function SlotSummaryFromDetails({
  slots,
  bookedOnly = false,
}: SlotSummaryFromDetailsProps) {
  const { available, booked, hasMixedDurations } =
    groupSlotsByTypeAndDuration(slots);

  const showAvailability = !bookedOnly;
  const hasAny = bookedOnly
    ? booked.length > 0
    : available.length > 0 || booked.length > 0;

  if (!hasAny) {
    return (
      <span className="text-[#5E5E5E]">
        {bookedOnly ? "No booked slots" : "No slots"}
      </span>
    );
  }

  return (
    <div className="mt-1 space-y-1 font-montserrat text-sm text-[#333333]">
      {showAvailability &&
        available.map((group) => (
          <div key={group.consultationType}>
            <p className="font-semibold">{group.label}:</p>
            {group.durations.map((dur) => (
              <p key={dur.durationMinutes}>
                {hasMixedDurations ? (
                  <>
                    <span className="font-medium">{dur.durationMinutes} min:</span>{" "}
                  </>
                ) : null}
                <span className="text-[#333333]">
                  {dur.startTimes.join(", ")}
                </span>
              </p>
            ))}
          </div>
        ))}
      {booked.length > 0 ? (
        <div>
          <p className="font-semibold">Booked:</p>
          {hasMixedDurations ? (
            (() => {
              const byDur = new Map<number, BookedSlot[]>();
              for (const b of booked) {
                const list = byDur.get(b.slotDurationMinutes) ?? [];
                list.push(b);
                byDur.set(b.slotDurationMinutes, list);
              }
              return [...byDur.entries()]
                .sort(([a], [b]) => a - b)
                .map(([dur, items]) => (
                  <p key={dur}>
                    <span className="font-medium">{dur} min:</span>{" "}
                    <span className="text-[#333333]">
                      {items
                        .map(
                          (b) =>
                            `${b.startTime} ${bookedConsultationAbbrev(b.consultationType)}`,
                        )
                        .join(", ")}
                    </span>
                  </p>
                ));
            })()
          ) : (
            <p>
              <span className="text-[#333333]">
                {booked
                  .map(
                    (b) =>
                      `${b.startTime} ${bookedConsultationAbbrev(b.consultationType)}`,
                  )
                  .join(", ")}
              </span>
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ScheduleDaySlotSummary({
  day,
  bookedOnly = false,
}: {
  day: ScheduleListDay;
  bookedOnly?: boolean;
}) {
  const slots = normalizeDaySlots(day);
  if (slots.length === 0) {
    return (
      <span className="text-[#5E5E5E]">
        {bookedOnly ? "No booked slots" : "No slots"}
      </span>
    );
  }
  return <SlotSummaryFromDetails slots={slots} bookedOnly={bookedOnly} />;
}
