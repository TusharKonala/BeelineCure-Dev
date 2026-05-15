"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";
import {
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

type JobApplication = {
  id: string;
  name: string;
  email: string;
  phone: string;
  coverNote: string | null;
  resumeUrl: string;
  createdAt: string;
  jobPostingId: string;
  jobTitle: string;
};

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
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<PostingForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PostingForm>(emptyForm);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JobPosting | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/careers");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load careers data");
      }
      setPostings(data.postings ?? []);
      setApplications(data.applications ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load careers data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
      await loadData();
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
      await loadData();
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
      await loadData();
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
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete posting");
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
          {loading ? (
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
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="font-montserrat text-lg font-semibold text-[#333333]">
            Applications
          </h2>
          {loading ? (
            <p className="mt-4 font-montserrat text-sm text-[#5e5e5e]">
              Loading...
            </p>
          ) : applications.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-[#e5e5e5] bg-[#fafafa] p-6 text-center">
              <p className="font-montserrat text-sm text-[#5e5e5e]">
                No applications yet.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-[#e5e5e5]">
              <table className="min-w-[800px] w-full border-collapse bg-white">
                <thead className="bg-[#fafafa]">
                  <tr>
                    <th className="px-3 py-3 text-left font-montserrat text-xs font-semibold uppercase tracking-wide text-[#5e5e5e]">
                      Applicant
                    </th>
                    <th className="px-3 py-3 text-left font-montserrat text-xs font-semibold uppercase tracking-wide text-[#5e5e5e]">
                      Role
                    </th>
                    <th className="px-3 py-3 text-left font-montserrat text-xs font-semibold uppercase tracking-wide text-[#5e5e5e]">
                      Contact
                    </th>
                    <th className="px-3 py-3 text-left font-montserrat text-xs font-semibold uppercase tracking-wide text-[#5e5e5e]">
                      Resume
                    </th>
                    <th className="px-3 py-3 text-left font-montserrat text-xs font-semibold uppercase tracking-wide text-[#5e5e5e]">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => (
                    <tr key={app.id} className="border-t border-[#ededed] align-top">
                      <td className="px-3 py-3 font-montserrat text-sm font-medium text-[#333333]">
                        {app.name}
                      </td>
                      <td className="px-3 py-3 font-montserrat text-sm text-[#333333]">
                        {app.jobTitle}
                      </td>
                      <td className="px-3 py-3 font-montserrat text-sm text-[#333333]">
                        <p>{app.email}</p>
                        <p className="text-[#5e5e5e]">{app.phone}</p>
                      </td>
                      <td className="px-3 py-3">
                        <a
                          href={app.resumeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-montserrat text-sm text-[#2555F3] hover:underline"
                        >
                          View resume
                        </a>
                      </td>
                      <td className="px-3 py-3 font-montserrat text-sm text-[#5e5e5e]">
                        {formatCreatedDate(app.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </Container>

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
