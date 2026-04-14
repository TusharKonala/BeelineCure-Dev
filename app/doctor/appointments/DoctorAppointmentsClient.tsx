"use client";

import { useEffect, useState } from "react";
import { formatDateInDoctorTz, formatTimeInDoctorTz } from "@/lib/timezone-display";

type ConsultationType = "CLINIC" | "ONLINE";
type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
type TabKey = "upcoming" | "completed" | "cancelled";
type DateFilterValue = "asc" | "desc" | "today" | "week" | "month";

type DoctorAppointmentItem = {
  id: string;
  patientName: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  timezone: string;
  consultationType: ConsultationType;
  status: AppointmentStatus;
  notes: string | null;
};

/** Hide native select arrow; custom chevron at `right: 0.75rem` with `pr-10` text inset. */
const SELECT_CHEVRON =
  'appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2220%22%20height%3D%2220%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%23333333%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E")] bg-[length:1rem_1rem] bg-[position:right_0.75rem_center] bg-no-repeat';

function consultationLabel(type: ConsultationType) {
  return type === "ONLINE" ? "Online" : "Clinic";
}

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

export default function DoctorAppointmentsClient() {
  const [appointments, setAppointments] = useState<DoctorAppointmentItem[]>([]);
  const [tab, setTab] = useState<TabKey>("upcoming");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilterValue>("desc");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadAppointments = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          tab,
          dateFilter,
        });
        if (search.trim()) params.set("search", search.trim());
        const res = await fetch(`/api/doctor/appointments?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setError("Failed to load appointments.");
          return;
        }
        const data = (await res.json()) as { items?: DoctorAppointmentItem[] };
        if (!cancelled) {
          setAppointments(Array.isArray(data.items) ? data.items : []);
        }
      } catch {
        if (!cancelled) setError("Failed to load appointments.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadAppointments();
    return () => {
      cancelled = true;
    };
  }, [dateFilter, search, tab]);

  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
          Appointments
        </h1>
        <p className="font-montserrat text-sm text-[#5E5E5E]">
          View appointments by status.
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

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-8 sm:gap-y-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-xs">
          <label
            htmlFor="doctor-appointments-search"
            className="shrink-0 font-montserrat text-sm font-medium text-[#333333]"
          >
            Patient
          </label>
          <input
            id="doctor-appointments-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or phone"
            className="w-full min-w-0 rounded-xl border border-[#e5e5e5] bg-white py-2 px-3 font-montserrat text-sm text-[#333333] shadow-sm outline-none focus:border-[#2555F3] focus:ring-2 focus:ring-[#2555F3]/20"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-xs">
          <label
            htmlFor="doctor-appointments-date-filter"
            className="shrink-0 font-montserrat text-sm font-medium text-[#333333]"
          >
            Date
          </label>
          <select
            id="doctor-appointments-date-filter"
            value={dateFilter}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "asc" || v === "desc" || v === "today" || v === "week" || v === "month") {
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

      {error ? (
        <div className="mt-6 rounded-xl border border-dashed border-[#e5e5e5] bg-[#fafafa] p-6 text-center">
          <p className="font-montserrat text-sm font-medium text-[#333333]">{error}</p>
        </div>
      ) : isLoading ? (
        <div className="mt-6 rounded-xl border border-dashed border-[#e5e5e5] bg-[#fafafa] p-6 text-center">
          <p className="font-montserrat text-sm font-medium text-[#333333]">Loading...</p>
        </div>
      ) : appointments.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[#e5e5e5] bg-[#fafafa] p-6 text-center">
          <p className="font-montserrat text-sm font-medium text-[#333333]">
            {tab === "upcoming"
              ? "No upcoming appointments."
              : tab === "completed"
                ? "No completed appointments yet."
                : "No cancelled appointments."}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid w-full grid-cols-1 gap-4">
          {appointments.map((a) => {
            const consultation = consultationLabel(a.consultationType);
            return (
              <div
                key={a.id}
                className="rounded-xl border border-[#e5e5e5] bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-montaga text-lg font-semibold text-[#333333]">
                      {a.patientName}
                    </p>
                    <p className="mt-1 font-montserrat text-sm text-[#5E5E5E]">{a.email}</p>
                    <p className="mt-1 font-montserrat text-sm text-[#5E5E5E]">{a.phone}</p>
                    <div className="mt-3 flex flex-col gap-1 font-montserrat text-sm text-[#333333] min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:items-center">
                      <span>
                        <span className="font-medium">Date:</span>{" "}
                        {formatDateInDoctorTz(a.date, a.time, a.timezone)}
                      </span>
                      <span
                        className="hidden text-[#e5e5e5] min-[400px]:mx-2 min-[400px]:inline"
                        aria-hidden
                      >
                        |
                      </span>
                      <span>
                        <span className="font-medium">Time:</span>{" "}
                        {formatTimeInDoctorTz(a.date, a.time, a.timezone)}
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

                {a.notes && (
                  <p className="mt-3 whitespace-pre-wrap font-montserrat text-sm text-[#333333]">
                    <span className="font-medium">Notes:</span> {a.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
