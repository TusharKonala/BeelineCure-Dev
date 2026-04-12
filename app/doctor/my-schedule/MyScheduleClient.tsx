"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  alignWindowEndExclusiveToSlotGrid,
  alignWindowStartToSlotGrid,
  ALLOWED_SLOT_DURATION_MINUTES,
  DEFAULT_SLOT_DURATION_MINUTES,
  DEFAULT_SLOT_WINDOW_END,
  DEFAULT_SLOT_WINDOW_START,
  generateSlots,
  type AllowedSlotDurationMinutes,
} from "@/lib/doctor-availability-slots";
import { timeToMinutes } from "@/lib/time";
import { addOneDayYmd } from "@/lib/doctor-local-date";
import { isDoctorTimeInPast } from "@/lib/timezone-display";
import { cn } from "@/lib/utils";
import { ViewSchedulePanel } from "./ViewSchedulePanel";

type Meta = {
  timezone: string;
  today: string;
  slotDurationMinutes: AllowedSlotDurationMinutes;
};

export function MyScheduleClient() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<"set" | "view">("set");
  const [mode, setMode] = useState<"range" | "single">("single");

  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [singleDate, setSingleDate] = useState("");

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  /** Bumps only after a successful Save so View Schedule list reloads; decoupled from Set-tab date changes. */
  const [viewScheduleListVersion, setViewScheduleListVersion] = useState(0);

  const [slotWindowStart, setSlotWindowStart] = useState(
    DEFAULT_SLOT_WINDOW_START,
  );
  const [slotWindowEnd, setSlotWindowEnd] = useState(DEFAULT_SLOT_WINDOW_END);
  const [slotDurationMinutes, setSlotDurationMinutes] =
    useState<AllowedSlotDurationMinutes>(DEFAULT_SLOT_DURATION_MINUTES);

  const singleDateInputRef = useRef<HTMLInputElement>(null);
  const rangeStartInputRef = useRef<HTMLInputElement>(null);
  const rangeEndInputRef = useRef<HTMLInputElement>(null);
  const slotWindowStartInputRef = useRef<HTMLInputElement>(null);
  const slotWindowEndInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/doctor/availability");
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Failed to load");
        }
        const data = (await res.json()) as Meta;
        if (!cancelled) {
          setMeta(data);
          if (
            ALLOWED_SLOT_DURATION_MINUTES.includes(
              data.slotDurationMinutes as AllowedSlotDurationMinutes,
            )
          ) {
            setSlotDurationMinutes(
              data.slotDurationMinutes as AllowedSlotDurationMinutes,
            );
          }
          const tomorrow = addOneDayYmd(data.today);
          setRangeStart(tomorrow);
          setRangeEnd(tomorrow);
          setSingleDate(data.today);
          setMetaError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setMetaError(e instanceof Error ? e.message : "Failed to load");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const displaySlots = useMemo(
    () =>
      generateSlots(
        slotWindowStart,
        slotWindowEnd,
        slotDurationMinutes,
      ),
    [slotWindowStart, slotWindowEnd, slotDurationMinutes],
  );

  const displaySlotsRef = useRef(displaySlots);
  displaySlotsRef.current = displaySlots;

  const fetchSlotsForDate = useCallback(async (date: string) => {
    setLoadingSlots(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/doctor/availability?date=${encodeURIComponent(date)}`,
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to load slots");
      }
      const data = (await res.json()) as {
        slotStarts: string[];
        today: string;
        timezone: string;
        slotDurationMinutes?: number;
      };
      if (
        data.slotDurationMinutes !== undefined &&
        ALLOWED_SLOT_DURATION_MINUTES.includes(
          data.slotDurationMinutes as AllowedSlotDurationMinutes,
        )
      ) {
        setSlotDurationMinutes(data.slotDurationMinutes as AllowedSlotDurationMinutes);
      }
      let starts = data.slotStarts;
      if (date === data.today) {
        starts = starts.filter(
          (t) => !isDoctorTimeInPast(date, t, data.timezone),
        );
      }
      const allowed = new Set(displaySlotsRef.current);
      setSelected(new Set(starts.filter((t) => allowed.has(t))));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
      setSelected(new Set());
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  /** Local-only: duration is persisted on Save (PUT). Avoid PATCH so changing length here does not clobber saved-day inference or snap the dropdown back from the API. */
  const applySlotDurationForEditing = useCallback(
    (minutes: AllowedSlotDurationMinutes) => {
      setSaveOk(null);
      setSlotDurationMinutes(minutes);
      setSlotWindowStart((s) => alignWindowStartToSlotGrid(s, minutes));
      setSlotWindowEnd((e) => alignWindowEndExclusiveToSlotGrid(e, minutes));
      setSelected(new Set());
    },
    [],
  );

  const handleEditDateFromView = useCallback((isoDate: string) => {
    setMainTab("set");
    setMode("single");
    setSaveOk(null);
    setSaveError(null);
    setSingleDate(isoDate);
  }, []);

  useEffect(() => {
    if (!meta) return;
    if (mainTab !== "set") return;
    if (mode !== "single") return;
    void fetchSlotsForDate(singleDate);
  }, [meta, mainTab, mode, singleDate, fetchSlotsForDate]);

  const scheduleIncludesToday = useMemo(() => {
    if (!meta) return false;
    if (mode === "single") return singleDate === meta.today;
    if (!rangeStart || !rangeEnd) return false;
    return meta.today >= rangeStart && meta.today <= rangeEnd;
  }, [meta, mode, singleDate, rangeStart, rangeEnd]);

  const selectableSlots = useMemo(() => {
    if (!meta) return displaySlots;
    if (!scheduleIncludesToday) return displaySlots;
    return displaySlots.filter(
      (t) => !isDoctorTimeInPast(meta.today, t, meta.timezone),
    );
  }, [meta, scheduleIncludesToday, displaySlots]);

  useEffect(() => {
    const allowed = new Set(displaySlots);
    setSelected((prev) => {
      const next = new Set([...prev].filter((t) => allowed.has(t)));
      if (next.size === prev.size && [...prev].every((t) => next.has(t))) {
        return prev;
      }
      return next;
    });
  }, [displaySlots]);

  useEffect(() => {
    if (!meta || !scheduleIncludesToday) return;
    setSelected((prev) => {
      const filtered = [...prev].filter(
        (t) => !isDoctorTimeInPast(meta.today, t, meta.timezone),
      );
      if (filtered.length === prev.size && filtered.every((t) => prev.has(t))) {
        return prev;
      }
      return new Set(filtered);
    });
  }, [meta, scheduleIncludesToday]);

  useEffect(() => {
    if (!meta || mode !== "range") return;
    const minStart = addOneDayYmd(meta.today);
    setRangeStart((s) => (s < minStart ? minStart : s));
  }, [mode, meta]);

  useEffect(() => {
    if (mode !== "range") return;
    setRangeEnd((e) => (e < rangeStart ? rangeStart : e));
  }, [mode, rangeStart]);

  function toggleSlot(t: string) {
    if (
      meta &&
      scheduleIncludesToday &&
      isDoctorTimeInPast(meta.today, t, meta.timezone)
    ) {
      return;
    }
    setSaveOk(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  async function handleSave() {
    if (!meta) return;
    if (mode === "range" && rangeStart > rangeEnd) {
      setSaveError("Start date must be on or before end date.");
      setSaveOk(null);
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveOk(null);
    try {
      const slotStarts = [...selected]
        .filter((t) => {
          if (!scheduleIncludesToday) return true;
          return !isDoctorTimeInPast(meta.today, t, meta.timezone);
        })
        .sort();
      const body =
        mode === "range"
          ? {
              mode: "range" as const,
              startDate: rangeStart,
              endDate: rangeEnd,
              slotStarts,
              slotDurationMinutes,
            }
          : {
              mode: "single" as const,
              singleDate,
              slotStarts,
              slotDurationMinutes,
            };
      const res = await fetch("/api/doctor/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Save failed");
      }
      const data = (await res.json()) as { affectedDates: number };
      setSaveOk(
        `Saved availability for ${data.affectedDates} day${data.affectedDates === 1 ? "" : "s"}.`,
      );
      if (mode === "single") {
        await fetchSlotsForDate(singleDate);
      }
      setMeta((m) => (m ? { ...m, slotDurationMinutes } : null));
      setViewScheduleListVersion((v) => v + 1);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (metaError) {
    return (
      <div className="w-full bg-[#fafafa] py-6 md:py-8">
        <Container>
          <p className="font-montserrat text-sm text-red-600">{metaError}</p>
        </Container>
      </div>
    );
  }

  if (!meta) {
    const slotSkeletonCount = generateSlots(
      DEFAULT_SLOT_WINDOW_START,
      DEFAULT_SLOT_WINDOW_END,
      DEFAULT_SLOT_DURATION_MINUTES,
    ).length;
    return (
      <div className="w-full bg-[#fafafa] py-6 md:py-8">
        <Container>
          <section className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
            <Skeleton className="h-8 w-56 max-w-[85%] md:h-9" />
            <div className="mt-5 flex flex-wrap gap-2">
              <Skeleton className="h-10 w-[9.5rem] rounded-xl" />
              <Skeleton className="h-10 w-[9.5rem] rounded-xl" />
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-full max-w-2xl" />
              <Skeleton className="h-4 w-full max-w-xl" />
            </div>
            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-11 w-40 max-w-[min(100%,10rem)] rounded-xl" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-11 w-40 max-w-[min(100%,10rem)] rounded-xl" />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Skeleton className="h-10 w-28 rounded-xl" />
              <Skeleton className="h-10 w-20 rounded-xl" />
            </div>
            <Skeleton className="mt-6 h-11 w-40 max-w-[min(100%,10rem)] rounded-xl" />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-10 w-28 rounded-xl" />
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              {Array.from({ length: slotSkeletonCount }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-10 min-w-[5.5rem] rounded-xl"
                />
              ))}
            </div>
            <Skeleton className="mt-3 h-3 w-full max-w-md" />
            <Skeleton className="mt-8 h-11 w-24 rounded-xl" />
          </section>
        </Container>
      </div>
    );
  }

  const minDate = meta.today;
  const rangeStartMinDate = addOneDayYmd(minDate);
  const slotWindowOk =
    timeToMinutes(slotWindowEnd) > timeToMinutes(slotWindowStart);
  const allSlotsSelected =
    selectableSlots.length > 0 && selectableSlots.every((t) => selected.has(t));

  /** Matches patient booking UI — readable, tappable, focus ring */
  const dateInputClassName =
    "block w-full min-w-0 cursor-pointer rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 font-montserrat text-sm text-[#111111] shadow-sm [color-scheme:light] focus:border-[#2555F3] focus:outline-none focus:ring-2 focus:ring-[#2555F3]/30 md:py-2.5";

  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <section className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
          <h1
            style={{
              WebkitTextStroke: "0.08px #333333",
              WebkitTextFillColor: "#333333",
            }}
            className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl"
          >
            My Schedule
          </h1>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMainTab("set")}
              className={cn(
                "cursor-pointer rounded-xl px-4 py-2 font-montserrat text-sm font-medium transition-colors",
                mainTab === "set"
                  ? "bg-[#2555F3] text-white"
                  : "border border-[#e5e5e5] bg-white text-[#333333] hover:bg-[#f5f5f5]",
              )}
            >
              Set Availability
            </button>
            <button
              type="button"
              onClick={() => setMainTab("view")}
              className={cn(
                "cursor-pointer rounded-xl px-4 py-2 font-montserrat text-sm font-medium transition-colors",
                mainTab === "view"
                  ? "bg-[#2555F3] text-white"
                  : "border border-[#e5e5e5] bg-white text-[#333333] hover:bg-[#f5f5f5]",
              )}
            >
              View Schedule
            </button>
          </div>

          <div
            className={cn(mainTab !== "view" && "hidden")}
            aria-hidden={mainTab !== "view"}
          >
            <ViewSchedulePanel
              timezone={meta.timezone}
              onEditDate={handleEditDateFromView}
              listRefreshVersion={viewScheduleListVersion}
            />
          </div>
          <div
            className={cn(mainTab !== "set" && "hidden")}
            aria-hidden={mainTab !== "set"}
          >
            <p className="mt-4 font-montserrat text-sm text-[#5E5E5E]">
                Choose slot length and a time window for your clinic timezone (
                <span className="font-medium text-[#333333]">
                  {meta.timezone}
                </span>
                ). The last slot starts so it ends by the window end time.
                Times snap to the grid for the selected length. Dates before
                today are not available.
              </p>

              <div className="mt-5">
                <label
                  htmlFor="schedule-slot-duration"
                  className="font-montserrat text-sm font-medium text-[#333333]"
                >
                  Slot length
                </label>
                <select
                  id="schedule-slot-duration"
                  value={slotDurationMinutes}
                  onChange={(e) => {
                    applySlotDurationForEditing(
                      Number(e.target.value) as AllowedSlotDurationMinutes,
                    );
                  }}
                  className={cn(
                    dateInputClassName,
                    "mt-2 max-w-[min(100%,12rem)] cursor-pointer appearance-none bg-[url(\"data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2220%22%20height%3D%2220%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%23333333%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E\")] bg-[length:1rem_1rem] bg-[position:right_0.75rem_center] bg-no-repeat py-2 pl-3 pr-10",
                  )}
                  aria-label="Slot duration in minutes"
                >
                  {ALLOWED_SLOT_DURATION_MINUTES.map((m) => (
                    <option key={m} value={m}>
                      {m} minutes
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
                <div>
                  <label
                    htmlFor="schedule-slot-window-start"
                    className="font-montserrat text-sm font-medium text-[#333333]"
                  >
                    Window start
                  </label>
                  <div
                    className="mt-2 w-full max-w-[10rem] cursor-pointer"
                    onClick={() =>
                      slotWindowStartInputRef.current?.showPicker?.()
                    }
                  >
                    <input
                      ref={slotWindowStartInputRef}
                      id="schedule-slot-window-start"
                      type="time"
                      step={slotDurationMinutes * 60}
                      value={slotWindowStart}
                      onChange={(e) => {
                        setSaveOk(null);
                        const v = e.target.value;
                        if (!v) return;
                        setSlotWindowStart(
                          alignWindowStartToSlotGrid(v, slotDurationMinutes),
                        );
                      }}
                      className={cn(dateInputClassName, "w-full")}
                      aria-label="Earliest slot start time"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="schedule-slot-window-end"
                    className="font-montserrat text-sm font-medium text-[#333333]"
                  >
                    Window end
                  </label>
                  <div
                    className="mt-2 w-full max-w-[10rem] cursor-pointer"
                    onClick={() => slotWindowEndInputRef.current?.showPicker?.()}
                  >
                    <input
                      ref={slotWindowEndInputRef}
                      id="schedule-slot-window-end"
                      type="time"
                      step={slotDurationMinutes * 60}
                      value={slotWindowEnd}
                      onChange={(e) => {
                        setSaveOk(null);
                        const v = e.target.value;
                        if (!v) return;
                        setSlotWindowEnd(
                          alignWindowEndExclusiveToSlotGrid(
                            v,
                            slotDurationMinutes,
                          ),
                        );
                      }}
                      className={cn(dateInputClassName, "w-full")}
                      aria-label="End of booking window (exclusive)"
                    />
                  </div>
                </div>
              </div>
              {!slotWindowOk && (
                <p className="mt-2 font-montserrat text-sm text-red-600">
                  End time must be after start time.
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("single");
                setSaveOk(null);
              }}
              className={cn(
                "cursor-pointer rounded-xl px-4 py-2 font-montserrat text-sm font-medium transition-colors",
                mode === "single"
                  ? "bg-[#2555F3] text-white"
                  : "border border-[#e5e5e5] bg-white text-[#333333] hover:bg-[#f5f5f5]",
              )}
            >
              Single day
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("range");
                setSaveOk(null);
              }}
              className={cn(
                "cursor-pointer rounded-xl px-4 py-2 font-montserrat text-sm font-medium transition-colors",
                mode === "range"
                  ? "bg-[#2555F3] text-white"
                  : "border border-[#e5e5e5] bg-white text-[#333333] hover:bg-[#f5f5f5]",
              )}
            >
              Range
            </button>
          </div>

          {mode === "single" ? (
            <div className="mt-6">
              <label
                htmlFor="schedule-single-date"
                className="font-montserrat text-sm font-medium text-[#333333]"
              >
                Date
              </label>
              <div
                className="mt-2 w-full max-w-[min(100%,10rem)] cursor-pointer"
                onClick={() => singleDateInputRef.current?.showPicker?.()}
              >
                <input
                  ref={singleDateInputRef}
                  id="schedule-single-date"
                  type="date"
                  min={minDate}
                  value={singleDate}
                  onChange={(e) => {
                    setSaveOk(null);
                    setSingleDate(e.target.value);
                  }}
                  className={dateInputClassName}
                  aria-label="Select schedule date"
                />
              </div>
              {loadError && (
                <p className="mt-2 font-montserrat text-sm text-red-600">
                  {loadError}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end">
                <div>
                  <label
                    htmlFor="schedule-range-start"
                    className="font-montserrat text-sm font-medium text-[#333333]"
                  >
                    Start date
                  </label>
                  <div
                    className="mt-2 inline-block w-full max-w-[min(100%,14rem)] cursor-pointer"
                    onClick={() => rangeStartInputRef.current?.showPicker?.()}
                  >
                    <input
                      ref={rangeStartInputRef}
                      id="schedule-range-start"
                      type="date"
                      min={rangeStartMinDate}
                      value={rangeStart}
                      onChange={(e) => {
                        setSaveOk(null);
                        setRangeStart(e.target.value);
                      }}
                      className={dateInputClassName}
                      aria-label="Select range start date"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="schedule-range-end"
                    className="font-montserrat text-sm font-medium text-[#333333]"
                  >
                    End date
                  </label>
                  <div
                    className="mt-2 inline-block w-full max-w-[min(100%,14rem)] cursor-pointer"
                    onClick={() => rangeEndInputRef.current?.showPicker?.()}
                  >
                    <input
                      ref={rangeEndInputRef}
                      id="schedule-range-end"
                      type="date"
                      min={
                        rangeStart >= rangeStartMinDate
                          ? rangeStart
                          : rangeStartMinDate
                      }
                      value={rangeEnd}
                      onChange={(e) => {
                        setSaveOk(null);
                        setRangeEnd(e.target.value);
                      }}
                      className={dateInputClassName}
                      aria-label="Select range end date"
                    />
                  </div>
                </div>
              </div>
              <p className="mt-3 font-montserrat text-xs text-[#5E5E5E]">
                To set today&apos;s slots, use Single day mode.
              </p>
            </>
          )}

          <div className="mt-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-montserrat text-sm font-medium text-[#333333]">
                Slots ({slotDurationMinutes} minutes each)
              </p>
              <button
                type="button"
                disabled={
                  (mode === "single" && loadingSlots) ||
                  selectableSlots.length === 0
                }
                onClick={() => {
                  setSaveOk(null);
                  if (allSlotsSelected) {
                    setSelected(new Set());
                  } else {
                    setSelected(new Set(selectableSlots));
                  }
                }}
                className={cn(
                  "shrink-0 cursor-pointer rounded-xl border px-4 py-2 font-montserrat text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  allSlotsSelected
                    ? "border-[#e5e5e5] bg-white text-[#333333] hover:bg-[#f5f5f5]"
                    : "border-[#2555F3] bg-[#2555F3] text-white hover:bg-[#1e44c7]",
                )}
              >
                {allSlotsSelected ? "Clear all" : "Select all"}
              </button>
            </div>
            {mode === "single" && loadingSlots ? (
              <div
                className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start"
                aria-busy="true"
                aria-label="Loading saved slots"
              >
                {(displaySlots.length > 0
                  ? displaySlots
                  : generateSlots(
                      DEFAULT_SLOT_WINDOW_START,
                      DEFAULT_SLOT_WINDOW_END,
                      slotDurationMinutes,
                    )
                ).map((t) => (
                  <Skeleton
                    key={t}
                    className="h-10 min-w-[5.5rem] rounded-xl"
                  />
                ))}
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                {slotWindowOk ? (
                  displaySlots.map((t) => {
                    const on = selected.has(t);
                    const past =
                      scheduleIncludesToday &&
                      isDoctorTimeInPast(meta.today, t, meta.timezone);
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={past}
                        aria-disabled={past}
                        onClick={() => toggleSlot(t)}
                        className={cn(
                          "min-w-[5.5rem] rounded-xl border px-3 py-2 font-montserrat text-sm transition-colors",
                          past
                            ? "cursor-not-allowed border-[#e5e5e5] bg-[#f5f5f5] text-[#9A9A9A] opacity-70"
                            : cn(
                                "cursor-pointer",
                                on
                                  ? "border-[#2555F3] bg-[#2555F3] text-white"
                                  : "border-[#e5e5e5] bg-[#fafafa] text-[#333333] hover:bg-[#f0f0f0]",
                              ),
                        )}
                      >
                        {t}
                      </button>
                    );
                  })
                ) : (
                  <p className="font-montserrat text-sm text-[#5E5E5E]">
                    Adjust the window times to see slots.
                  </p>
                )}
              </div>
            )}
            <p className="mt-3 font-montserrat text-xs text-[#5E5E5E]">
              {mode === "range"
                ? "Selected slots apply to every day in the range on save."
                : "Changes apply only to the selected day."}
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              className="h-11 cursor-pointer rounded-xl bg-[#2555F3] font-montserrat text-sm font-medium text-white hover:bg-[#1e44c7] disabled:cursor-not-allowed"
              disabled={saving || (mode === "single" && loadingSlots)}
              onClick={() => void handleSave()}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            {saveOk && (
              <p className="font-montserrat text-sm text-green-700">{saveOk}</p>
            )}
            {saveError && (
              <p className="font-montserrat text-sm text-red-600">
                {saveError}
              </p>
            )}
          </div>
          </div>
        </section>
      </Container>
    </div>
  );
}
