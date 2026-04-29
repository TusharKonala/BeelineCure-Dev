"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Container } from "@/components/layout/Container";

type ApprovalTab = "PENDING" | "APPROVED" | "REJECTED";

type AdminDoctor = {
  id: string;
  userId: string | null;
  name: string;
  email: string | null;
  specialization: string;
  licenseNumber: string;
  yearsExperience: number | null;
  profilePhotoUrl: string;
  approvalStatus: ApprovalTab;
  createdAt: string;
};

const tabItems: Array<{ key: ApprovalTab; label: string }> = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

function statusBadgeClass(status: ApprovalTab) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 font-montserrat text-xs font-medium";
  if (status === "APPROVED") return `${base} border-[#d7f2d9] bg-[#effcf0] text-[#1f7a36]`;
  if (status === "REJECTED") return `${base} border-[#ffd9d9] bg-[#fff1f1] text-[#b42318]`;
  return `${base} border-[#ffe7b8] bg-[#fff8eb] text-[#9a6700]`;
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

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
  const [activeTab, setActiveTab] = useState<ApprovalTab>("PENDING");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyDoctorId, setBusyDoctorId] = useState<string | null>(null);

  const loadDoctors = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/doctors", { cache: "no-store" });
      if (!response.ok) {
        setError("Failed to load doctors.");
        return;
      }
      const data = (await response.json()) as { doctors?: AdminDoctor[] };
      setDoctors(Array.isArray(data.doctors) ? data.doctors : []);
    } catch {
      setError("Failed to load doctors.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDoctors();
  }, []);

  const filteredDoctors = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return doctors.filter((doctor) => {
      if (doctor.approvalStatus !== activeTab) return false;
      if (!normalized) return true;
      const nameMatch = doctor.name.toLowerCase().includes(normalized);
      const emailMatch = (doctor.email ?? "").toLowerCase().includes(normalized);
      return nameMatch || emailMatch;
    });
  }, [activeTab, doctors, query]);

  const tabCounts = useMemo(() => {
    return {
      PENDING: doctors.filter((doctor) => doctor.approvalStatus === "PENDING").length,
      APPROVED: doctors.filter((doctor) => doctor.approvalStatus === "APPROVED").length,
      REJECTED: doctors.filter((doctor) => doctor.approvalStatus === "REJECTED").length,
    };
  }, [doctors]);

  const handleAction = async (doctor: AdminDoctor, action: "approve" | "reject") => {
    if (!doctor.userId) return;
    setBusyDoctorId(doctor.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/doctors/${doctor.userId}/${action === "approve" ? "approve" : "reject"}`,
        { method: "POST" },
      );
      if (!response.ok) {
        setError(
          action === "approve"
            ? "Failed to approve doctor. Please try again."
            : "Failed to reject doctor. Please try again.",
        );
        return;
      }
      await loadDoctors();
    } catch {
      setError(
        action === "approve"
          ? "Failed to approve doctor. Please try again."
          : "Failed to reject doctor. Please try again.",
      );
    } finally {
      setBusyDoctorId(null);
    }
  };

  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <section className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
          <h1 className="font-montaga text-2xl font-semibold text-[#333333] md:text-3xl">
            Doctors
          </h1>
          <p className="mt-2 max-w-2xl font-montserrat text-sm text-[#5e5e5e]">
            Review doctor profiles and manage approval status.
          </p>

          <div className="mt-6">
            <label className="sr-only" htmlFor="admin-doctors-search">
              Search doctors
            </label>
            <input
              id="admin-doctors-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by doctor name or email"
              className="w-full rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 font-montserrat text-sm text-[#333333] shadow-sm outline-none focus:border-[#2555F3] focus:ring-2 focus:ring-[#2555F3]/20"
            />
          </div>

          <div className="mt-4 grid gap-3 md:hidden">
            <label className="sr-only" htmlFor="admin-doctor-tab">
              Filter doctors by status
            </label>
            <select
              id="admin-doctor-tab"
              value={activeTab}
              onChange={(event) => setActiveTab(event.target.value as ApprovalTab)}
              className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 pr-9 font-montserrat text-sm text-[#333333] shadow-sm outline-none focus:border-[#2555F3] focus:ring-2 focus:ring-[#2555F3]/20"
            >
              {tabItems.map((tab) => (
                <option key={tab.key} value={tab.key}>
                  {tab.label} ({tabCounts[tab.key]})
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 hidden flex-wrap gap-2 md:flex">
            {tabItems.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-full px-4 py-2 font-montserrat text-sm transition-colors ${
                    active
                      ? "bg-[#2555F3] text-white"
                      : "border border-[#e5e5e5] bg-white text-[#333333] hover:bg-[#fafafa]"
                  }`}
                >
                  {tab.label} ({tabCounts[tab.key]})
                </button>
              );
            })}
          </div>

          {error ? (
            <div className="mt-6 rounded-xl border border-dashed border-[#ffd0d0] bg-[#fff6f6] p-4">
              <p className="font-montserrat text-sm text-[#b42318]">{error}</p>
            </div>
          ) : null}

          {loading ? (
            <div className="mt-6 rounded-xl border border-dashed border-[#e5e5e5] bg-[#fafafa] p-6 text-center">
              <p className="font-montserrat text-sm text-[#5e5e5e]">Loading doctors...</p>
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-[#e5e5e5] bg-[#fafafa] p-6 text-center">
              <p className="font-montserrat text-sm text-[#5e5e5e]">
                No doctors found for this filter.
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-xl border border-[#e5e5e5]">
              <table className="min-w-[980px] w-full border-collapse bg-white">
                <thead className="bg-[#fafafa]">
                  <tr>
                    <th className="px-3 py-3 text-left font-montserrat text-xs font-semibold uppercase tracking-wide text-[#5e5e5e]">
                      Doctor
                    </th>
                    <th className="px-3 py-3 text-left font-montserrat text-xs font-semibold uppercase tracking-wide text-[#5e5e5e]">
                      Email
                    </th>
                    <th className="px-3 py-3 text-left font-montserrat text-xs font-semibold uppercase tracking-wide text-[#5e5e5e]">
                      Specialization
                    </th>
                    <th className="px-3 py-3 text-left font-montserrat text-xs font-semibold uppercase tracking-wide text-[#5e5e5e]">
                      License
                    </th>
                    <th className="px-3 py-3 text-left font-montserrat text-xs font-semibold uppercase tracking-wide text-[#5e5e5e]">
                      Experience
                    </th>
                    <th className="px-3 py-3 text-left font-montserrat text-xs font-semibold uppercase tracking-wide text-[#5e5e5e]">
                      Created
                    </th>
                    <th className="px-3 py-3 text-left font-montserrat text-xs font-semibold uppercase tracking-wide text-[#5e5e5e]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDoctors.map((doctor) => {
                    const isBusy = busyDoctorId === doctor.id;
                    const hasAccount = Boolean(doctor.userId);
                    return (
                      <tr key={doctor.id} className="border-t border-[#ededed] align-top">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative h-10 w-10 overflow-hidden rounded-full border border-[#e5e5e5] bg-[#f5f5f5]">
                              <Image
                                src={doctor.profilePhotoUrl}
                                alt={doctor.name}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            </div>
                            <p className="font-montserrat text-sm font-medium text-[#333333]">
                              {doctor.name}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-montserrat text-sm text-[#5e5e5e]">
                          {doctor.email ?? "—"}
                        </td>
                        <td className="px-3 py-3 font-montserrat text-sm text-[#333333]">
                          {doctor.specialization}
                        </td>
                        <td className="px-3 py-3 font-montserrat text-sm text-[#333333]">
                          {doctor.licenseNumber}
                        </td>
                        <td className="px-3 py-3 font-montserrat text-sm text-[#333333]">
                          {doctor.yearsExperience != null
                            ? `${doctor.yearsExperience} yrs`
                            : "—"}
                        </td>
                        <td className="px-3 py-3 font-montserrat text-sm text-[#5e5e5e]">
                          {formatCreatedDate(doctor.createdAt)}
                        </td>
                        <td className="px-3 py-3">
                          {doctor.approvalStatus === "PENDING" ? (
                            hasAccount ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleAction(doctor, "approve")}
                                  className="rounded-lg bg-[#2555F3] px-3 py-1.5 font-montserrat text-xs font-medium text-white transition-colors hover:bg-[#1e44c7] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleAction(doctor, "reject")}
                                  className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 font-montserrat text-xs font-medium text-[#b42318] transition-colors hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-[#e5e5e5] bg-[#fafafa] px-2.5 py-1 font-montserrat text-xs font-medium text-[#5e5e5e]">
                                No account linked
                              </span>
                            )
                          ) : (
                            <span className={statusBadgeClass(doctor.approvalStatus)}>
                              {doctor.approvalStatus === "APPROVED"
                                ? "Approved"
                                : "Rejected"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </Container>
    </div>
  );
}
