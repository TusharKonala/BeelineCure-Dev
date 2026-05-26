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

type SlotSummaryFromDetailsProps = {
  slots: SlotDetail[];
  /** When true, only render the "Booked" line — used by the Booked-only filter on View Schedule. */
  bookedOnly?: boolean;
};

export function SlotSummaryFromDetails({
  slots,
  bookedOnly = false,
}: SlotSummaryFromDetailsProps) {
  const { clinicOnlyAvail, onlineOnlyAvail, clinicOnlineAvail, booked } =
    groupScheduleDaySlots(slots);

  const showAvailability = !bookedOnly;
  const hasAny = bookedOnly
    ? booked.length > 0
    : clinicOnlyAvail.length > 0 ||
      onlineOnlyAvail.length > 0 ||
      clinicOnlineAvail.length > 0 ||
      booked.length > 0;

  if (!hasAny) {
    return (
      <span className="text-[#5E5E5E]">
        {bookedOnly ? "No booked slots" : "No slots"}
      </span>
    );
  }

  return (
    <div className="mt-1 space-y-1 font-montserrat text-sm text-[#333333]">
      {showAvailability && clinicOnlyAvail.length > 0 ? (
        <p>
          <span className="font-semibold">Clinic:</span>{" "}
          <span className="text-[#333333]">{clinicOnlyAvail.join(", ")}</span>
        </p>
      ) : null}
      {showAvailability && onlineOnlyAvail.length > 0 ? (
        <p>
          <span className="font-semibold">Online:</span>{" "}
          <span className="text-[#333333]">{onlineOnlyAvail.join(", ")}</span>
        </p>
      ) : null}
      {showAvailability && clinicOnlineAvail.length > 0 ? (
        <p>
          <span className="font-semibold">Clinic/Online:</span>{" "}
          <span className="text-[#333333]">{clinicOnlineAvail.join(", ")}</span>
        </p>
      ) : null}
      {booked.length > 0 ? (
        <p>
          <span className="font-semibold">Booked:</span>{" "}
          <span className="text-[#333333]">
            {booked
              .map(
                (b) =>
                  `${b.startTime} ${bookedConsultationAbbrev(b.consultationType)}`,
              )
              .join(", ")}
          </span>
        </p>
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
