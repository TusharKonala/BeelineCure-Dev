"use client";

import {
  formatDateInPatientTz,
  formatTimeInPatientTz,
} from "@/lib/timezone-display";

export function PatientLocalDateTime({
  date,
  time,
  doctorTimezone,
}: {
  date: string;
  time: string;
  doctorTimezone: string;
}) {
  return (
    <>
      <div className="flex flex-col justify-between gap-1 font-montserrat text-sm text-[#333333] sm:flex-row sm:items-center">
        <span className="font-medium text-[#111111]">Date</span>
        <span className="text-[#5E5E5E] sm:text-right">
          {formatDateInPatientTz(date, time, doctorTimezone)}
        </span>
      </div>
      <div className="flex flex-col justify-between gap-1 font-montserrat text-sm text-[#333333] sm:flex-row sm:items-center">
        <span className="font-medium text-[#111111]">Time</span>
        <span className="text-[#5E5E5E] sm:text-right">
          {formatTimeInPatientTz(date, time, doctorTimezone)}
        </span>
      </div>
    </>
  );
}
