"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useInfiniteScroll from "react-infinite-scroll-hook";

import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/skeleton";
import { DOCTOR_SPECIALIZATIONS } from "@/lib/doctor-specializations";
import { formatDoctorDisplayName } from "@/lib/doctor-name";
import {
  specializationForSymptom,
  searchSymptoms,
} from "@/lib/symptomMap";

type DoctorCard = {
  id: string;
  name: string;
  specialization: string;
  profilePhotoUrl: string;
  slug: string | null;
};

type ListResponse = {
  items: DoctorCard[];
  page: number;
  limit: number;
  hasMore: boolean;
};

const CHEVRON_CLASSES =
  'appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000/svg%22%20width%3D%2220%22%20height%3D%2220%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%23333333%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E")] bg-[length:1rem_1rem] bg-[position:right_0.75rem_center] bg-no-repeat';

function doctorListUrl(params: {
  specialty: string;
  consultationMode: string;
  feeMinCents: string;
  feeMaxCents: string;
  page: number;
}): string {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("limit", "12");
  if (params.specialty) sp.set("specialty", params.specialty);
  if (params.consultationMode === "online" || params.consultationMode === "clinic") {
    sp.set("consultationMode", params.consultationMode);
  }
  if (params.feeMinCents.trim()) sp.set("feeMinCents", params.feeMinCents.trim());
  if (params.feeMaxCents.trim()) sp.set("feeMaxCents", params.feeMaxCents.trim());
  return `/api/doctors?${sp.toString()}`;
}

export function DoctorSelectionSection() {
  const [doctors, setDoctors] = useState<DoctorCard[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [specialty, setSpecialty] = useState("");
  const [consultationMode, setConsultationMode] = useState("");
  const [feeMinCents, setFeeMinCents] = useState("");
  const [feeMaxCents, setFeeMaxCents] = useState("");

  const [symptomInput, setSymptomInput] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const symptomBoxRef = useRef<HTMLDivElement | null>(null);

  const filterKey = useMemo(
    () =>
      JSON.stringify({
        specialty,
        consultationMode,
        feeMinCents,
        feeMaxCents,
      }),
    [specialty, consultationMode, feeMinCents, feeMaxCents],
  );

  const latestRequestIdRef = useRef(0);

  const loadDoctors = useCallback(
    async (nextPage: number, append: boolean) => {
      const requestId = ++latestRequestIdRef.current;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          doctorListUrl({
            specialty,
            consultationMode,
            feeMinCents,
            feeMaxCents,
            page: nextPage,
          }),
        );
        if (!res.ok) {
          if (latestRequestIdRef.current !== requestId) return;
          setError("Failed to load doctors.");
          return;
        }
        const data = (await res.json()) as ListResponse;
        if (latestRequestIdRef.current !== requestId) return;
        const items = Array.isArray(data.items) ? data.items : [];
        setDoctors((cur) => (append ? [...cur, ...items] : items));
        setHasMore(Boolean(data.hasMore));
        setPage(typeof data.page === "number" ? data.page : nextPage);
      } catch {
        if (latestRequestIdRef.current !== requestId) return;
        setError("Failed to load doctors.");
      } finally {
        if (latestRequestIdRef.current === requestId) setLoading(false);
      }
    },
    [specialty, consultationMode, feeMinCents, feeMaxCents],
  );

  useEffect(() => {
    void loadDoctors(1, false);
  }, [filterKey, loadDoctors]);

  const [sentryRef] = useInfiniteScroll({
    loading,
    hasNextPage: hasMore,
    onLoadMore: () => void loadDoctors(page + 1, true),
    disabled: false,
    rootMargin: "0px 0px 320px 0px",
  });

  const suggestions = useMemo(
    () => searchSymptoms(symptomInput, { limit: 12 }),
    [symptomInput],
  );

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const el = symptomBoxRef.current;
      if (el && !el.contains(e.target as Node)) setShowSuggest(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const cardHref = (d: DoctorCard) =>
    d.slug ? `/doctors/${d.slug}` : `/book-appointment/${d.id}`;

  return (
    <section className="w-full bg-[#fafafa] py-10 md:py-14 lg:py-16">
      <Container>
        <div className="flex flex-col gap-2 text-left md:text-left">
          <h2 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
            Select a Doctor
          </h2>
        </div>

        <div className="mt-6 flex flex-col gap-4 border-b border-[#e5e5e5] pb-6">
          <div className="relative w-full max-w-xl" ref={symptomBoxRef}>
            <label className="font-montserrat text-xs font-medium text-[#5e5e5e]">
              Search by symptom
            </label>
            <input
              type="text"
              value={symptomInput}
              onChange={(e) => {
                setSymptomInput(e.target.value);
                setShowSuggest(true);
              }}
              onFocus={() => setShowSuggest(true)}
              placeholder="e.g. chest pain, headache…"
              className="mt-1 w-full rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 font-montserrat text-sm text-[#111111] outline-none focus:border-[#2555F3] focus:ring-2 focus:ring-[#2555F3]/20"
              autoComplete="off"
            />
            {showSuggest && suggestions.length > 0 && (
              <ul
                className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-[#e5e5e5] bg-white py-1 shadow-md"
                role="listbox"
              >
                {suggestions.map((sym) => (
                  <li key={sym}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left font-montserrat text-sm text-[#333333] hover:bg-[#f5f5f5]"
                      onClick={() => {
                        const spec = specializationForSymptom(sym);
                        if (spec) setSpecialty(spec);
                        setSymptomInput(sym);
                        setShowSuggest(false);
                      }}
                    >
                      <span className="text-[#111111]">{sym}</span>
                      {specializationForSymptom(sym) && (
                        <span className="ml-2 text-xs text-[#777777]">
                          → {specializationForSymptom(sym)}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label
                className="font-montserrat text-xs font-medium text-[#5e5e5e]"
                htmlFor="filter-specialty"
              >
                Specialty
              </label>
              <select
                id="filter-specialty"
                value={specialty}
                onChange={(e) => {
                  setSpecialty(e.target.value);
                  setSymptomInput("");
                }}
                className={`w-full rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 pr-10 font-montserrat text-sm text-[#333333] ${CHEVRON_CLASSES}`}
              >
                <option value="">All specialties</option>
                {DOCTOR_SPECIALIZATIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label
                className="font-montserrat text-xs font-medium text-[#5e5e5e]"
                htmlFor="filter-mode"
              >
                Consultation mode
              </label>
              <select
                id="filter-mode"
                value={consultationMode}
                onChange={(e) => setConsultationMode(e.target.value)}
                className={`w-full rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 pr-10 font-montserrat text-sm text-[#333333] ${CHEVRON_CLASSES}`}
              >
                <option value="">Any</option>
                <option value="online">Online</option>
                <option value="clinic">Clinic</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label
                className="font-montserrat text-xs font-medium text-[#5e5e5e]"
                htmlFor="fee-min"
              >
                Min fee (cents, 30 min slot)
              </label>
              <input
                id="fee-min"
                type="number"
                inputMode="numeric"
                min={0}
                value={feeMinCents}
                onChange={(e) => setFeeMinCents(e.target.value)}
                placeholder="1500"
                className="w-full rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 font-montserrat text-sm text-[#333333]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                className="font-montserrat text-xs font-medium text-[#5e5e5e]"
                htmlFor="fee-max"
              >
                Max fee (cents, 30 min slot)
              </label>
              <input
                id="fee-max"
                type="number"
                inputMode="numeric"
                min={0}
                value={feeMaxCents}
                onChange={(e) => setFeeMaxCents(e.target.value)}
                placeholder="8000"
                className="w-full rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 font-montserrat text-sm text-[#333333]"
              />
            </div>
          </div>
        </div>

        {loading && doctors.length === 0 && (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:mt-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-sm"
              >
                <Skeleton className="aspect-4/3 w-full rounded-t-2xl bg-[#e5e5e5] min-[450px]:h-72 min-[450px]:aspect-auto sm:h-64" />
                <div className="flex flex-1 flex-col gap-3 px-5 py-4">
                  <Skeleton className="h-6 w-32 bg-[#e5e5e5] md:h-7" />
                  <Skeleton className="h-4 w-24 bg-[#e5e5e5]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-6 font-montserrat text-sm text-red-600">{error}</div>
        )}

        {!loading && !error && doctors.length === 0 && (
          <p className="mt-8 font-montserrat text-sm text-[#5e5e5e]">
            No doctors match these filters yet.
          </p>
        )}

        {(doctors.length > 0 || (loading && doctors.length > 0)) && (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:mt-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {doctors.map((doctor) => (
              <article
                key={doctor.id}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:border-[#2555F3] hover:shadow-md"
              >
                <Link
                  href={cardHref(doctor)}
                  className="relative aspect-4/3 w-full overflow-hidden rounded-t-2xl bg-[#f5f5f5] min-[450px]:h-72 min-[450px]:aspect-auto sm:h-64"
                >
                  <Image
                    src={doctor.profilePhotoUrl}
                    alt={formatDoctorDisplayName(doctor.name)}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </Link>
                <div className="flex flex-1 flex-col gap-3 px-5 py-4">
                  <Link
                    href={cardHref(doctor)}
                    className="font-montaga text-lg text-[#111111] hover:text-[#2555F3] md:text-xl"
                  >
                    {formatDoctorDisplayName(doctor.name)}
                  </Link>
                  <span className="font-montserrat text-sm text-[#5E5E5E]">
                    {doctor.specialization}
                  </span>
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Link
                      href={cardHref(doctor)}
                      className="inline-flex items-center justify-center rounded-full bg-[#2555F3] px-4 py-2 font-montserrat text-xs font-medium text-white transition hover:bg-[#1e44c7] focus:outline-none focus:ring-2 focus:ring-[#2555F3]/30 focus:ring-offset-2"
                    >
                      View profile
                    </Link>
                    <Link
                      href={`/book-appointment/${doctor.id}`}
                      className="inline-flex items-center justify-center rounded-full border border-[#d4d4d4] px-4 py-2 font-montserrat text-xs font-medium text-[#333333] transition hover:border-[#2555F3] hover:text-[#2555F3] focus:outline-none focus:ring-2 focus:ring-[#2555F3]/30 focus:ring-offset-2"
                    >
                      Book appointment
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {hasMore && (
          <div
            ref={sentryRef}
            aria-hidden="true"
            className="h-8 w-full shrink-0"
          />
        )}

        {loading && doctors.length > 0 && (
          <p className="mt-6 text-center font-montserrat text-sm text-[#5e5e5e]">
            Loading…
          </p>
        )}
      </Container>
    </section>
  );
}
