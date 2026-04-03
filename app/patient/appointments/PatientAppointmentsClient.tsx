"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type ConsultationType = "CLINIC" | "ONLINE";
type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

export type PatientAppointmentItem = {
  id: string;
  doctorId: string;
  cancelToken: string | null;
  rescheduleToken: string | null;
  date: string; // ISO date-only (YYYY-MM-DD)
  time: string;
  consultationType: ConsultationType;
  status: AppointmentStatus;
  doctor: {
    name: string;
    specialization?: string | null;
  };
};

type TabKey = "upcoming" | "completed" | "cancelled";

/** Hide native select arrow; custom chevron at `right: 0.75rem` with `pr-10` text inset. */
const SELECT_CHEVRON =
  'appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2220%22%20height%3D%2220%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%23333333%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E")] bg-[length:1rem_1rem] bg-[position:right_0.75rem_center] bg-no-repeat';

/** `YYYY-MM-DD` → e.g. Mon, 24 Mar 2026 (calendar date, no UTC shift). */
function formatAppointmentDate(isoDate: string) {
  const parts = isoDate.split("-").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return isoDate;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** `HH:mm` or `HH:mm:ss` → e.g. 2:30 PM */
function formatAppointmentTime(time: string) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time.trim());
  if (!m) return time;
  const hour = Number.parseInt(m[1], 10);
  const minute = Number.parseInt(m[2], 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return time;
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${period}`;
}

function isAppointmentInPastLocal(dateParam: string, timeParam: string) {
  const dParts = dateParam.split("-").map((p) => Number.parseInt(p, 10));
  const tParts = timeParam.split(":").map((p) => Number.parseInt(p, 10));
  if (
    dParts.length !== 3 ||
    dParts.some((n) => Number.isNaN(n)) ||
    tParts.length < 2 ||
    tParts.some((n) => Number.isNaN(n))
  ) {
    return false; // don't hide actions if formatting is unexpected
  }

  const [y, m, d] = dParts;
  const [hour, minute] = tParts;
  const start = new Date(y, m - 1, d, hour, minute, 0, 0);
  return start.getTime() <= Date.now();
}

function consultationLabel(type: ConsultationType) {
  return type === "ONLINE" ? "Online" : "Clinic";
}

/** Compare by calendar date, then time string (HH:mm). */
function compareAppointmentDateTime(
  a: PatientAppointmentItem,
  b: PatientAppointmentItem,
) {
  const byDate = a.date.localeCompare(b.date);
  if (byDate !== 0) return byDate;
  return a.time.localeCompare(b.time, undefined, { numeric: true });
}

function localYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday–Sunday (local), bounds as YYYY-MM-DD inclusive. */
function thisWeekBounds(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: localYMD(monday), end: localYMD(sunday) };
}

function thisMonthBounds(): { start: string; end: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: localYMD(first), end: localYMD(last) };
}

type DateFilterValue = "asc" | "desc" | "today" | "week" | "month";

function badgeClass(kind: "consultation" | "status", value: string) {
  if (kind === "consultation") {
    return value === "Online"
      ? "border-[#2555F3]/30 bg-[#2555F3]/10 text-[#2555F3]"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800";
  }

  switch (value) {
    case "PENDING":
      return "border-amber-500/30 bg-amber-500/10 text-amber-800";
    case "CONFIRMED":
      return "border-[#2555F3]/30 bg-[#2555F3]/10 text-[#2555F3]";
    case "COMPLETED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800";
    case "CANCELLED":
      return "border-red-500/30 bg-red-500/10 text-red-800";
    default:
      return "border-[#e5e5e5] bg-[#fafafa] text-[#333333]";
  }
}

export default function PatientAppointmentsClient({
  appointments,
}: {
  appointments: PatientAppointmentItem[];
}) {
  const [tab, setTab] = useState<TabKey>("upcoming");
  const [doctorId, setDoctorId] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<DateFilterValue>("desc");

  const { upcoming, completed, cancelled } = useMemo(() => {
    const upcoming = appointments.filter(
      (a) => a.status === "PENDING" || a.status === "CONFIRMED",
    );
    const completed = appointments.filter((a) => a.status === "COMPLETED");
    const cancelled = appointments.filter((a) => a.status === "CANCELLED");
    return { upcoming, completed, cancelled };
  }, [appointments]);

  const doctorOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const a of appointments) {
      if (!byId.has(a.doctorId)) {
        byId.set(a.doctorId, a.doctor.name);
      }
    }
    return Array.from(byId.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [appointments]);

  const active =
    tab === "upcoming" ? upcoming : tab === "completed" ? completed : cancelled;

  const effectiveDoctorId = useMemo(() => {
    if (!doctorId) return "";
    return doctorOptions.some((d) => d.id === doctorId) ? doctorId : "";
  }, [doctorId, doctorOptions]);

  const filtered = useMemo(() => {
    if (!effectiveDoctorId) return active;
    return active.filter((a) => a.doctorId === effectiveDoctorId);
  }, [active, effectiveDoctorId]);

  const rangeFiltered = useMemo(() => {
    if (dateFilter === "asc" || dateFilter === "desc") return filtered;
    const today = localYMD(new Date());
    if (dateFilter === "today") {
      return filtered.filter((a) => a.date === today);
    }
    if (dateFilter === "week") {
      const { start, end } = thisWeekBounds();
      return filtered.filter((a) => a.date >= start && a.date <= end);
    }
    if (dateFilter === "month") {
      const { start, end } = thisMonthBounds();
      return filtered.filter((a) => a.date >= start && a.date <= end);
    }
    return filtered;
  }, [filtered, dateFilter]);

  const sortedFiltered = useMemo(() => {
    const list = [...rangeFiltered];
    const sortDesc = dateFilter === "desc";
    list.sort((a, b) => {
      const c = compareAppointmentDateTime(a, b);
      return sortDesc ? -c : c;
    });
    return list;
  }, [rangeFiltered, dateFilter]);

  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col items-start gap-2 md:flex-row md:items-start md:justify-between md:gap-3">
          <div className="min-w-0 md:flex-1">
            <h1 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
              Appointments
            </h1>
            <Link
              href="/book-appointment"
              className="mt-1 inline-block font-montserrat text-sm text-[#2555F3] md:hidden"
            >
              Book an appointment →
            </Link>
          </div>
          <div className="hidden shrink-0 md:block">
            <Button
              asChild
              className="w-fit cursor-pointer rounded-xl md:inline-flex md:w-auto"
            >
              <Link href="/book-appointment">Book Appointment</Link>
            </Button>
          </div>
        </div>
        <p className="font-montserrat text-sm text-[#5E5E5E]">
          Manage your upcoming and past appointments.
        </p>
      </div>

      <div className="mt-6 sm:hidden">
        <select
          aria-label="Appointment status tab"
          value={tab}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "upcoming" || v === "completed" || v === "cancelled") {
              setTab(v);
            }
          }}
          className={`w-full cursor-pointer rounded-xl border border-[#e5e5e5] bg-white py-2 pl-3 pr-10 font-montserrat text-sm font-medium text-[#333333] shadow-sm outline-none focus:border-[#2555F3] focus:ring-2 focus:ring-[#2555F3]/20 ${SELECT_CHEVRON}`}
        >
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="mt-6 hidden sm:flex sm:flex-row sm:gap-3">
        <button
          type="button"
          onClick={() => setTab("upcoming")}
          className={`cursor-pointer rounded-xl px-4 py-2 font-montserrat text-sm font-medium transition-colors ${
            tab === "upcoming"
              ? "bg-[#2555F3] text-white"
              : "border border-[#e5e5e5] bg-white text-[#333333] hover:bg-[#fafafa]"
          }`}
        >
          Upcoming
        </button>
        <button
          type="button"
          onClick={() => setTab("completed")}
          className={`cursor-pointer rounded-xl px-4 py-2 font-montserrat text-sm font-medium transition-colors ${
            tab === "completed"
              ? "bg-[#2555F3] text-white"
              : "border border-[#e5e5e5] bg-white text-[#333333] hover:bg-[#fafafa]"
          }`}
        >
          Completed
        </button>
        <button
          type="button"
          onClick={() => setTab("cancelled")}
          className={`cursor-pointer rounded-xl px-4 py-2 font-montserrat text-sm font-medium transition-colors ${
            tab === "cancelled"
              ? "bg-[#2555F3] text-white"
              : "border border-[#e5e5e5] bg-white text-[#333333] hover:bg-[#fafafa]"
          }`}
        >
          Cancelled
        </button>
      </div>

      {appointments.length > 0 && (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-8 sm:gap-y-4">
          {doctorOptions.length > 1 && (
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-xs">
              <label
                htmlFor="patient-appointments-doctor-filter"
                className="shrink-0 font-montserrat text-sm font-medium text-[#333333]"
              >
                Doctor
              </label>
              <select
                id="patient-appointments-doctor-filter"
                value={effectiveDoctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className={`w-full min-w-0 cursor-pointer rounded-xl border border-[#e5e5e5] bg-white py-2 pl-3 pr-10 font-montserrat text-sm text-[#333333] shadow-sm outline-none focus:border-[#2555F3] focus:ring-2 focus:ring-[#2555F3]/20 ${SELECT_CHEVRON}`}
              >
                <option value="">All doctors</option>
                {doctorOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-xs">
            <label
              htmlFor="patient-appointments-date-filter"
              className="shrink-0 font-montserrat text-sm font-medium text-[#333333]"
            >
              Date
            </label>
            <select
              id="patient-appointments-date-filter"
              value={dateFilter}
              onChange={(e) => {
                const v = e.target.value;
                if (
                  v === "asc" ||
                  v === "desc" ||
                  v === "today" ||
                  v === "week" ||
                  v === "month"
                ) {
                  setDateFilter(v);
                }
              }}
              className={`w-full min-w-0 cursor-pointer rounded-xl border border-[#e5e5e5] bg-white py-2 pl-3 pr-10 font-montserrat text-sm text-[#333333] shadow-sm outline-none focus:border-[#2555F3] focus:ring-2 focus:ring-[#2555F3]/20 ${SELECT_CHEVRON}`}
            >
              <option value="desc">Latest first</option>
              <option value="asc">Earliest first</option>
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
            </select>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[#e5e5e5] bg-[#fafafa] p-6 text-center">
          {active.length > 0 && effectiveDoctorId ? (
            <>
              <p className="font-montserrat text-sm font-medium text-[#333333]">
                No appointments with this doctor
                {tab === "upcoming"
                  ? " in upcoming."
                  : tab === "completed"
                    ? " in completed."
                    : " in cancelled."}
              </p>
              <button
                type="button"
                onClick={() => setDoctorId("")}
                className="mt-3 font-montserrat text-sm font-medium text-[#2555F3] underline underline-offset-2 hover:text-[#1a45d9]"
              >
                Show all doctors
              </button>
            </>
          ) : (
            <>
              <p className="font-montserrat text-sm font-medium text-[#333333]">
                {tab === "upcoming"
                  ? "No upcoming appointments."
                  : tab === "completed"
                    ? "No completed appointments yet."
                    : "No cancelled appointments."}
              </p>
              <p className="mt-2 font-montserrat text-sm text-[#5E5E5E]">
                {tab === "upcoming"
                  ? "Book an appointment to get started."
                  : "Your appointments will show up here once available."}
              </p>
            </>
          )}
        </div>
      ) : rangeFiltered.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[#e5e5e5] bg-[#fafafa] p-6 text-center">
          <p className="font-montserrat text-sm font-medium text-[#333333]">
            {dateFilter === "today"
              ? "No appointments today."
              : dateFilter === "week"
                ? "No appointments this week."
                : "No appointments this month."}
          </p>
          <button
            type="button"
            onClick={() => setDateFilter("desc")}
            className="mt-3 cursor-pointer font-montserrat text-sm font-medium text-[#2555F3] underline underline-offset-2 hover:text-[#1a45d9]"
          >
            Show all dates
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4">
          {sortedFiltered.map((a) => {
            const consultation = consultationLabel(a.consultationType);
            return (
              <div
                key={a.id}
                className="rounded-xl border border-[#e5e5e5] bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-montaga text-lg font-semibold text-[#333333]">
                      {a.doctor.name}
                    </p>
                    {a.doctor.specialization && (
                      <p className="mt-1 font-montserrat text-sm text-[#5E5E5E]">
                        {a.doctor.specialization}
                      </p>
                    )}
                    <div className="mt-3 flex flex-col gap-1 font-montserrat text-sm text-[#333333] min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:items-center">
                      <span>
                        <span className="font-medium">Date:</span>{" "}
                        {formatAppointmentDate(a.date)}
                      </span>
                      <span
                        className="hidden text-[#e5e5e5] min-[400px]:mx-2 min-[400px]:inline"
                        aria-hidden
                      >
                        |
                      </span>
                      <span>
                        <span className="font-medium">Time:</span>{" "}
                        {formatAppointmentTime(a.time)}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 font-montserrat text-xs font-medium ${badgeClass(
                        "consultation",
                        consultation,
                      )}`}
                    >
                      {consultation}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 font-montserrat text-xs font-medium ${badgeClass(
                        "status",
                        a.status,
                      )}`}
                    >
                      {a.status}
                    </span>
                  </div>
                </div>

                {tab === "upcoming" &&
                  !isAppointmentInPastLocal(a.date, a.time) &&
                  a.status !== "COMPLETED" &&
                  a.status !== "CANCELLED" &&
                  (a.cancelToken || a.rescheduleToken) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {a.rescheduleToken && (
                        <Button
                          asChild
                          className="cursor-pointer rounded-xl font-montserrat"
                          size="sm"
                        >
                          <Link
                            href={`/reschedule?${new URLSearchParams({
                              appointmentId: a.id,
                              token: a.rescheduleToken,
                            }).toString()}`}
                          >
                            Reschedule
                          </Link>
                        </Button>
                      )}
                      {a.cancelToken && (
                        <Button
                          asChild
                          variant="outline"
                          className="cursor-pointer rounded-xl font-montserrat"
                          size="sm"
                        >
                          <Link
                            href={`/cancel?${new URLSearchParams({
                              appointmentId: a.id,
                              token: a.cancelToken,
                            }).toString()}`}
                          >
                            Cancel
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

