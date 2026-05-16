"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useInfiniteScroll from "react-infinite-scroll-hook";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";
import {
  applicationStatusValues,
  formatJobTypeLabel,
  jobTypeValues,
} from "@/lib/careers-schemas";

type JobType = (typeof jobTypeValues)[number];

type JobPosting = {
  id: string;
  title: string;
  description: string;
  type: JobType;
  isRemote: boolean;
  salaryRange: string | null;
  isActive: boolean;
  createdAt: string;
  applicationCount: number;
};

type ApplicationStatus = (typeof applicationStatusValues)[number];

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

type ScoreBand = "all" | "low" | "mid" | "high";

type PostingForm = {
  title: string;
  description: string;
  type: JobType;
  isRemote: boolean;
  salaryRange: string;
  isActive: boolean;
};

const emptyForm: PostingForm = {
  title: "",
  description: "",
  type: "FULL_TIME",
  isRemote: false,
  salaryRange: "",
  isActive: true,
};

const SELECT_CHEVRON =
  'appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2220%22%20height%3D%2220%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%23333333%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E")] bg-[length:1rem_1rem] bg-[position:right_0.75rem_center] bg-no-repeat';

function jobTypeBadgeClass(type: JobType) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 font-montserrat text-xs font-medium";
  if (type === "FULL_TIME") return `${base} border-[#d7e4ff] bg-[#eef3ff] text-[#2555F3]`;
  if (type === "PART_TIME") return `${base} border-[#ffe7b8] bg-[#fff8eb] text-[#9a6700]`;
  return `${base} border-[#e5e5e5] bg-[#f5f5f5] text-[#5e5e5e]`;
}

function activeBadgeClass(isActive: boolean) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 font-montserrat text-xs font-medium";
  if (isActive) return `${base} border-[#d7f2d9] bg-[#effcf0] text-[#1f7a36]`;
  return `${base} border-[#e5e5e5] bg-[#f5f5f5] text-[#5e5e5e]`;
}

function statusBadgeClass(status: ApplicationStatus) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 font-montserrat text-xs font-medium";
  switch (status) {
    case "SHORTLISTED":
      return `${base} border-[#d7e4ff] bg-[#eef3ff] text-[#2555F3]`;
    case "REJECTED":
      return `${base} border-[#ffd0d0] bg-[#fff6f6] text-[#b42318]`;
    case "HIRED":
      return `${base} border-[#d7f2d9] bg-[#effcf0] text-[#1f7a36]`;
    default:
      return `${base} border-[#e5e5e5] bg-[#f5f5f5] text-[#5e5e5e]`;
  }
}

function aiScoreBadgeClass(score: number | null) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 font-montserrat text-xs font-semibold";
  if (score === null) return `${base} border-[#e5e5e5] bg-[#fafafa] text-[#5e5e5e]`;
  if (score >= 8) return `${base} border-[#d7f2d9] bg-[#effcf0] text-[#1f7a36]`;
  if (score >= 5) return `${base} border-[#ffe7b8] bg-[#fff8eb] text-[#9a6700]`;
  return `${base} border-[#ffd0d0] bg-[#fff6f6] text-[#b42318]`;
}

function scoreBandParams(band: ScoreBand): { scoreMin?: string; scoreMax?: string } {
  if (band === "low") return { scoreMin: "1", scoreMax: "4" };
  if (band === "mid") return { scoreMin: "5", scoreMax: "7" };
  if (band === "high") return { scoreMin: "8", scoreMax: "10" };
  return {};
}

function formatCreatedDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function PostingFormFields({
  form,
  onChange,
  idPrefix,
}: {
  form: PostingForm;
  onChange: (next: PostingForm) => void;
  idPrefix: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor={`${idPrefix}-title`}
          className="mb-1 block font-montserrat text-sm font-medium text-[#333333]"
        >
          Title
        </label>
        <input
          id={`${idPrefix}-title`}
          value={form.title}
          onChange={(e) => onChange({ ...form, title: e.target.value })}
          className="w-full rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 font-montserrat text-sm text-[#333333] outline-none focus:border-[#2555F3] focus:ring-2 focus:ring-[#2555F3]/20"
        />
      </div>
      <div>
        <label
          htmlFor={`${idPrefix}-description`}
          className="mb-1 block font-montserrat text-sm font-medium text-[#333333]"
        >
          Description
        </label>
        <textarea
          id={`${idPrefix}-description`}
          rows={5}
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          className="w-full rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 font-montserrat text-sm text-[#333333] outline-none focus:border-[#2555F3] focus:ring-2 focus:ring-[#2555F3]/20"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${idPrefix}-type`}
            className="mb-1 block font-montserrat text-sm font-medium text-[#333333]"
          >
            Type
          </label>
          <select
            id={`${idPrefix}-type`}
            value={form.type}
            onChange={(e) =>
              onChange({ ...form, type: e.target.value as JobType })
            }
            className={`w-full cursor-pointer rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 pr-10 font-montserrat text-sm text-[#333333] outline-none focus:border-[#2555F3] focus:ring-2 focus:ring-[#2555F3]/20 ${SELECT_CHEVRON}`}
          >
            {jobTypeValues.map((t) => (
              <option key={t} value={t}>
                {formatJobTypeLabel(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={`${idPrefix}-salary`}
            className="mb-1 block font-montserrat text-sm font-medium text-[#333333]"
          >
            Salary range (optional)
          </label>
          <input
            id={`${idPrefix}-salary`}
            value={form.salaryRange}
            onChange={(e) => onChange({ ...form, salaryRange: e.target.value })}
            placeholder="e.g. $80k–$100k"
            className="w-full rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 font-montserrat text-sm text-[#333333] outline-none focus:border-[#2555F3] focus:ring-2 focus:ring-[#2555F3]/20"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex cursor-pointer items-center gap-2 font-montserrat text-sm text-[#333333]">
          <input
            type="checkbox"
            checked={form.isRemote}
            onChange={(e) => onChange({ ...form, isRemote: e.target.checked })}
            className="size-4 rounded border-[#e5e5e5]"
          />
          Remote
        </label>
        <label className="flex cursor-pointer items-center gap-2 font-montserrat text-sm text-[#333333]">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => onChange({ ...form, isActive: e.target.checked })}
            className="size-4 rounded border-[#e5e5e5]"
          />
          Active (visible on public careers page)
        </label>
      </div>
    </div>
  );
}

export default function AdminCareersPage() {
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [postingsCursor, setPostingsCursor] = useState<string | null>(null);
  const [postingsHasMore, setPostingsHasMore] = useState(false);
  const [postingsLoading, setPostingsLoading] = useState(true);
  const postingsRequestIdRef = useRef(0);

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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<PostingForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PostingForm>(emptyForm);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JobPosting | null>(null);
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

  const loadPostings = useCallback(async (cursor: string | null, append: boolean) => {
    const requestId = ++postingsRequestIdRef.current;
    setPostingsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "10" });
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/admin/careers/postings?${params}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (postingsRequestIdRef.current !== requestId) return;
      if (!res.ok) throw new Error(data.error ?? "Failed to load postings");
      const next = Array.isArray(data.items) ? data.items : [];
      setPostings((cur) => (append ? [...cur, ...next] : next));
      setPostingsHasMore(Boolean(data.hasMore));
      setPostingsCursor(data.nextCursor ?? null);
    } catch (err) {
      if (postingsRequestIdRef.current !== requestId) return;
      setError(err instanceof Error ? err.message : "Failed to load postings");
    } finally {
      if (postingsRequestIdRef.current === requestId) setPostingsLoading(false);
    }
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
    void loadPostings(null, false);
  }, [loadPostings]);

  useEffect(() => {
    void loadApplications(null, false);
  }, [loadApplications]);

  const [postingsSentryRef] = useInfiniteScroll({
    loading: postingsLoading,
    hasNextPage: postingsHasMore,
    onLoadMore: () => {
      if (postingsCursor) void loadPostings(postingsCursor, true);
    },
    rootMargin: "0px 0px 300px 0px",
  });

  const [appsSentryRef] = useInfiniteScroll({
    loading: appsLoading,
    hasNextPage: appsHasMore,
    onLoadMore: () => {
      if (appsCursor) void loadApplications(appsCursor, true);
    },
    rootMargin: "0px 0px 300px 0px",
  });

  async function reloadAll() {
    await Promise.all([loadPostings(null, false), loadApplications(null, false)]);
  }

  useEffect(() => {
    if (!deleteTarget) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyId) setDeleteTarget(null);
    }
    window.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [deleteTarget, busyId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusyId("create");
    setError(null);
    try {
      const res = await fetch("/api/careers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          salaryRange: createForm.salaryRange.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create posting");
      setCreateForm(emptyForm);
      setShowCreateForm(false);
      await reloadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create posting");
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpdate(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/careers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          salaryRange: editForm.salaryRange.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update posting");
      setEditingId(null);
      await reloadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update posting");
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleActive(posting: JobPosting) {
    setBusyId(posting.id);
    setError(null);
    try {
      const res = await fetch(`/api/careers/${posting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !posting.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update posting");
      await reloadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update posting");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    setError(null);
    try {
      const res = await fetch(`/api/careers/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete posting");
      setDeleteTarget(null);
      await reloadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete posting");
    } finally {
      setBusyId(null);
    }
  }

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

  function startEdit(posting: JobPosting) {
    setEditingId(posting.id);
    setEditForm({
      title: posting.title,
      description: posting.description,
      type: posting.type,
      isRemote: posting.isRemote,
      salaryRange: posting.salaryRange ?? "",
      isActive: posting.isActive,
    });
  }

  return (
    <main className="py-8 lg:py-10">
      <Container>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-montaga text-2xl text-[#333333] md:text-3xl">
              Careers
            </h1>
            <p className="mt-1 font-montserrat text-sm text-[#5e5e5e]">
              Manage job postings and review applications.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setShowCreateForm((v) => !v)}
            className="cursor-pointer rounded-full bg-[#2555F3] font-montserrat text-sm hover:bg-[#1e44c7]"
          >
            {showCreateForm ? "Cancel" : "New posting"}
          </Button>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-dashed border-[#ffd0d0] bg-[#fff6f6] p-4">
            <p className="font-montserrat text-sm text-[#b42318]">{error}</p>
          </div>
        ) : null}

        {showCreateForm ? (
          <form
            onSubmit={handleCreate}
            className="mt-6 rounded-xl border border-[#e5e5e5] bg-white p-6"
          >
            <h2 className="font-montserrat text-lg font-semibold text-[#333333]">
              New job posting
            </h2>
            <div className="mt-4">
              <PostingFormFields
                form={createForm}
                onChange={setCreateForm}
                idPrefix="create"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                type="submit"
                disabled={busyId === "create"}
                className="cursor-pointer rounded-full bg-[#2555F3] font-montserrat text-sm hover:bg-[#1e44c7]"
              >
                {busyId === "create" ? "Creating..." : "Create posting"}
              </Button>
            </div>
          </form>
        ) : null}

        <section className="mt-10">
          <h2 className="font-montserrat text-lg font-semibold text-[#333333]">
            Job postings
          </h2>
          {postingsLoading && postings.length === 0 ? (
            <p className="mt-4 font-montserrat text-sm text-[#5e5e5e]">
              Loading...
            </p>
          ) : postings.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-[#e5e5e5] bg-[#fafafa] p-6 text-center">
              <p className="font-montserrat text-sm text-[#5e5e5e]">
                No job postings yet.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {postings.map((posting) => {
                const isEditing = editingId === posting.id;
                const isBusy = busyId === posting.id;
                return (
                  <article
                    key={posting.id}
                    className="rounded-xl border border-[#e5e5e5] bg-white p-5"
                  >
                    {isEditing ? (
                      <>
                        <PostingFormFields
                          form={editForm}
                          onChange={setEditForm}
                          idPrefix={`edit-${posting.id}`}
                        />
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleUpdate(posting.id)}
                            className="cursor-pointer rounded-full bg-[#2555F3] font-montserrat text-sm hover:bg-[#1e44c7]"
                          >
                            {isBusy ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => setEditingId(null)}
                            className="cursor-pointer rounded-full font-montserrat text-sm"
                          >
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-montserrat text-base font-semibold text-[#333333]">
                              {posting.title}
                            </h3>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className={jobTypeBadgeClass(posting.type)}>
                                {formatJobTypeLabel(posting.type)}
                              </span>
                              {posting.isRemote ? (
                                <span className="inline-flex items-center rounded-full border border-[#d7e4ff] bg-[#eef3ff] px-2.5 py-1 font-montserrat text-xs font-medium text-[#2555F3]">
                                  Remote
                                </span>
                              ) : null}
                              <span className={activeBadgeClass(posting.isActive)}>
                                {posting.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                          </div>
                          <p className="font-montserrat text-xs text-[#5e5e5e]">
                            {posting.applicationCount} application
                            {posting.applicationCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        {posting.salaryRange ? (
                          <p className="mt-2 font-montserrat text-sm text-[#5e5e5e]">
                            {posting.salaryRange}
                          </p>
                        ) : null}
                        <p className="mt-3 whitespace-pre-wrap font-montserrat text-sm text-[#333333]">
                          {posting.description}
                        </p>
                        <p className="mt-2 font-montserrat text-xs text-[#5e5e5e]">
                          Posted {formatCreatedDate(posting.createdAt)}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => startEdit(posting)}
                            className="cursor-pointer rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 font-montserrat text-xs font-medium text-[#333333] transition-colors hover:bg-[#fafafa] disabled:opacity-60"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleToggleActive(posting)}
                            className="cursor-pointer rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 font-montserrat text-xs font-medium text-[#333333] transition-colors hover:bg-[#fafafa] disabled:opacity-60"
                          >
                            {isBusy
                              ? "Updating..."
                              : posting.isActive
                                ? "Deactivate"
                                : "Activate"}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setDeleteTarget(posting)}
                            className="cursor-pointer rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 font-montserrat text-xs font-medium text-[#b42318] transition-colors hover:bg-[#fafafa] disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
              {(postingsHasMore || postingsLoading) && postings.length > 0 && (
                <div
                  ref={postingsSentryRef}
                  className="py-4 text-center font-montserrat text-sm text-[#5e5e5e]"
                >
                  {postingsLoading ? "Loading..." : "Scroll for more"}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="font-montserrat text-lg font-semibold text-[#333333]">
            Applications
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
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
            <p className="mt-4 font-montserrat text-sm text-[#5e5e5e]">
              Loading...
            </p>
          ) : applications.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-[#e5e5e5] bg-[#fafafa] p-6 text-center">
              <p className="font-montserrat text-sm text-[#5e5e5e]">
                No applications match these filters.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
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
        </section>
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

      {mounted && deleteTarget
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
                <h3 className="font-montserrat text-lg font-semibold text-[#333333]">
                  Delete job posting?
                </h3>
                <p className="mt-2 font-montserrat text-sm text-[#5e5e5e]">
                  This will permanently delete &ldquo;{deleteTarget.title}
                  &rdquo; and all associated applications.
                </p>
                <div className="mt-6 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busyId === deleteTarget.id}
                    onClick={() => setDeleteTarget(null)}
                    className="cursor-pointer rounded-full font-montserrat text-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={busyId === deleteTarget.id}
                    onClick={() => void handleDelete()}
                    className="cursor-pointer rounded-full bg-[#b42318] font-montserrat text-sm hover:bg-[#912018]"
                  >
                    {busyId === deleteTarget.id ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </main>
  );
}
