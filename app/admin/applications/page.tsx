"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useInfiniteScroll from "react-infinite-scroll-hook";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";
import { applicationStatusValues } from "@/lib/careers-schemas";
import {
  aiScoreBadgeClass,
  formatCreatedDate,
  scoreBandParams,
  SELECT_CHEVRON,
  statusBadgeClass,
  type ApplicationStatus,
  type ScoreBand,
} from "@/lib/admin-careers-ui";

type JobApplication = {
  id: string;
  name: string;
  email: string;
  phone: string;
  coverNote: string | null;
  resumeText: string;
  resumeUrl: string | null;
  status: ApplicationStatus;
  aiScore: number | null;
  aiSummary: string | null;
  aiRecommendation: "SHORTLIST" | "REJECT" | null;
  createdAt: string;
  jobPostingId: string;
  jobTitle: string;
};

export default function AdminCareersApplicationsPage() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [appsCursor, setAppsCursor] = useState<string | null>(null);
  const [appsHasMore, setAppsHasMore] = useState(false);
  const [appsLoading, setAppsLoading] = useState(true);
  const appsRequestIdRef = useRef(0);

  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "ALL">(
    "ALL",
  );
  const [scoreBand, setScoreBand] = useState<ScoreBand>("all");

  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const [scheduleTarget, setScheduleTarget] = useState<JobApplication | null>(
    null,
  );
  const [scheduleRound, setScheduleRound] = useState("1");
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [scheduleAttendee, setScheduleAttendee] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadApplications = useCallback(
    async (cursor: string | null, append: boolean) => {
      const requestId = ++appsRequestIdRef.current;
      setAppsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: "10" });
        if (cursor) params.set("cursor", cursor);
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        const band = scoreBandParams(scoreBand);
        if (band.scoreMin) params.set("scoreMin", band.scoreMin);
        if (band.scoreMax) params.set("scoreMax", band.scoreMax);
        const res = await fetch(
          `/api/admin/careers/applications?${params}`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (appsRequestIdRef.current !== requestId) return;
        if (!res.ok) throw new Error(data.error ?? "Failed to load applications");
        const next = Array.isArray(data.items) ? data.items : [];
        setApplications((cur) => (append ? [...cur, ...next] : next));
        setAppsHasMore(Boolean(data.hasMore));
        setAppsCursor(data.nextCursor ?? null);
      } catch (err) {
        if (appsRequestIdRef.current !== requestId) return;
        setError(
          err instanceof Error ? err.message : "Failed to load applications",
        );
      } finally {
        if (appsRequestIdRef.current === requestId) setAppsLoading(false);
      }
    },
    [statusFilter, scoreBand],
  );

  useEffect(() => {
    void loadApplications(null, false);
  }, [loadApplications]);

  const [appsSentryRef] = useInfiniteScroll({
    loading: appsLoading,
    hasNextPage: appsHasMore,
    onLoadMore: () => {
      if (appsCursor) void loadApplications(appsCursor, true);
    },
    rootMargin: "0px 0px 300px 0px",
  });

  async function handleStatusChange(
    app: JobApplication,
    status: ApplicationStatus,
  ) {
    setBusyId(app.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/careers/applications/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update status");
      setApplications((cur) =>
        cur.map((a) => (a.id === app.id ? { ...a, status } : a)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setBusyId(null);
    }
  }

  async function handleScheduleInterview(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleTarget) return;
    setBusyId(scheduleTarget.id);
    setScheduleError(null);
    try {
      const scheduledAt = new Date(scheduleAt);
      if (Number.isNaN(scheduledAt.getTime())) {
        throw new Error("Invalid date and time");
      }
      const res = await fetch(
        `/api/admin/careers/applications/${scheduleTarget.id}/interviews`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roundNumber: Number(scheduleRound),
            scheduledAt: scheduledAt.toISOString(),
            notes: scheduleNotes.trim() || null,
            attendeeEmail: scheduleAttendee.trim() || null,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to schedule interview");
      setScheduleTarget(null);
      setScheduleRound("1");
      setScheduleAt("");
      setScheduleNotes("");
      setScheduleAttendee("");
    } catch (err) {
      setScheduleError(
        err instanceof Error ? err.message : "Failed to schedule interview",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="py-8 lg:py-10">
      <Container>
        <div>
          <h1 className="font-montaga text-2xl text-[#333333] md:text-3xl">
            Job applications
          </h1>
          <p className="mt-1 font-montserrat text-sm text-[#5e5e5e]">
            Review candidates, update status, and schedule interviews.
          </p>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-dashed border-[#ffd0d0] bg-[#fff6f6] p-4">
            <p className="font-montserrat text-sm text-[#b42318]">{error}</p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`cursor-pointer rounded-full border px-3 py-1 font-montserrat text-xs font-medium ${
              statusFilter === "ALL"
                ? "border-[#2555F3] bg-[#eef3ff] text-[#2555F3]"
                : "border-[#e5e5e5] bg-white text-[#333333]"
            }`}
          >
            All
          </button>
          {applicationStatusValues.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`cursor-pointer rounded-full border px-3 py-1 font-montserrat text-xs font-medium ${
                statusFilter === s
                  ? "border-[#2555F3] bg-[#eef3ff] text-[#2555F3]"
                  : "border-[#e5e5e5] bg-white text-[#333333]"
              }`}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["all", "All scores"],
              ["low", "1–4"],
              ["mid", "5–7"],
              ["high", "8–10"],
            ] as const
          ).map(([band, label]) => (
            <button
              key={band}
              type="button"
              onClick={() => setScoreBand(band)}
              className={`cursor-pointer rounded-full border px-3 py-1 font-montserrat text-xs font-medium ${
                scoreBand === band
                  ? "border-[#2555F3] bg-[#eef3ff] text-[#2555F3]"
                  : "border-[#e5e5e5] bg-white text-[#333333]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {appsLoading && applications.length === 0 ? (
          <p className="mt-6 font-montserrat text-sm text-[#5e5e5e]">Loading...</p>
        ) : applications.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-[#e5e5e5] bg-[#fafafa] p-6 text-center">
            <p className="font-montserrat text-sm text-[#5e5e5e]">
              No applications match these filters.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {applications.map((app) => (
              <article
                key={app.id}
                className="rounded-xl border border-[#e5e5e5] bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-montserrat text-base font-semibold text-[#333333]">
                      {app.name}
                    </h3>
                    <p className="mt-1 font-montserrat text-sm text-[#5e5e5e]">
                      {app.jobTitle}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={aiScoreBadgeClass(app.aiScore)}>
                      {app.aiScore !== null ? `${app.aiScore}/10` : "—"}
                    </span>
                    <span className={statusBadgeClass(app.status)}>
                      {app.status}
                    </span>
                  </div>
                </div>
                {app.aiSummary ? (
                  <p className="mt-3 line-clamp-3 font-montserrat text-sm text-[#333333]">
                    {app.aiSummary}
                  </p>
                ) : (
                  <p className="mt-3 font-montserrat text-sm text-[#5e5e5e]">
                    AI screening pending…
                  </p>
                )}
                <p className="mt-2 font-montserrat text-sm text-[#333333]">
                  {app.email} · {app.phone}
                </p>
                <p className="mt-2 line-clamp-2 font-montserrat text-xs text-[#5e5e5e]">
                  {app.resumeText}
                </p>
                {app.resumeUrl ? (
                  <a
                    href={app.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block font-montserrat text-sm text-[#2555F3] hover:underline"
                  >
                    View resume link
                  </a>
                ) : null}
                <p className="mt-2 font-montserrat text-xs text-[#5e5e5e]">
                  Applied {formatCreatedDate(app.createdAt)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <select
                    value={app.status}
                    disabled={busyId === app.id}
                    onChange={(e) =>
                      void handleStatusChange(
                        app,
                        e.target.value as ApplicationStatus,
                      )
                    }
                    className={`${SELECT_CHEVRON} cursor-pointer rounded-lg border border-[#e5e5e5] bg-white py-1.5 pl-3 pr-9 font-montserrat text-xs text-[#333333]`}
                  >
                    {applicationStatusValues.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {app.status === "SHORTLISTED" ? (
                    <button
                      type="button"
                      disabled={busyId === app.id}
                      onClick={() => {
                        setScheduleTarget(app);
                        setScheduleError(null);
                      }}
                      className="cursor-pointer rounded-lg border border-[#2555F3] bg-[#eef3ff] px-3 py-1.5 font-montserrat text-xs font-medium text-[#2555F3] hover:bg-[#d7e4ff] disabled:opacity-60"
                    >
                      Schedule interview
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
            {(appsHasMore || appsLoading) && applications.length > 0 && (
              <div
                ref={appsSentryRef}
                className="py-4 text-center font-montserrat text-sm text-[#5e5e5e]"
              >
                {appsLoading ? "Loading..." : "Scroll for more"}
              </div>
            )}
          </div>
        )}
      </Container>

      {mounted && scheduleTarget
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <form
                onSubmit={handleScheduleInterview}
                className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg"
              >
                <h3 className="font-montserrat text-lg font-semibold text-[#333333]">
                  Schedule interview
                </h3>
                <p className="mt-1 font-montserrat text-sm text-[#5e5e5e]">
                  {scheduleTarget.name} — {scheduleTarget.jobTitle}
                </p>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="mb-1 block font-montserrat text-sm font-medium text-[#333333]">
                      Round number
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={scheduleRound}
                      onChange={(e) => setScheduleRound(e.target.value)}
                      className="w-full rounded-xl border border-[#e5e5e5] px-3 py-2 font-montserrat text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-montserrat text-sm font-medium text-[#333333]">
                      Proposed date & time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={scheduleAt}
                      onChange={(e) => setScheduleAt(e.target.value)}
                      className="w-full rounded-xl border border-[#e5e5e5] px-3 py-2 font-montserrat text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-montserrat text-sm font-medium text-[#333333]">
                      Interviewer email (optional)
                    </label>
                    <input
                      type="email"
                      value={scheduleAttendee}
                      onChange={(e) => setScheduleAttendee(e.target.value)}
                      placeholder="interviewer@company.com"
                      className="w-full rounded-xl border border-[#e5e5e5] px-3 py-2 font-montserrat text-sm"
                    />
                    <p className="mt-1 font-montserrat text-xs text-[#5e5e5e]">
                      Candidate is added automatically. Connect Google Calendar in
                      Settings to generate Meet links after they confirm.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block font-montserrat text-sm font-medium text-[#333333]">
                      Notes (optional)
                    </label>
                    <textarea
                      rows={3}
                      value={scheduleNotes}
                      onChange={(e) => setScheduleNotes(e.target.value)}
                      className="w-full rounded-xl border border-[#e5e5e5] px-3 py-2 font-montserrat text-sm"
                    />
                  </div>
                </div>
                {scheduleError ? (
                  <p className="mt-3 font-montserrat text-sm text-[#b42318]">
                    {scheduleError}
                  </p>
                ) : null}
                <div className="mt-6 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busyId === scheduleTarget.id}
                    onClick={() => setScheduleTarget(null)}
                    className="cursor-pointer rounded-full font-montserrat text-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={busyId === scheduleTarget.id}
                    className="cursor-pointer rounded-full bg-[#2555F3] font-montserrat text-sm hover:bg-[#1e44c7]"
                  >
                    {busyId === scheduleTarget.id ? "Sending..." : "Send invite"}
                  </Button>
                </div>
              </form>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
