"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";
import { formatJobTypeLabel, jobTypeValues } from "@/lib/careers-schemas";

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
};

function jobTypeBadgeClass(type: JobType) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 font-montserrat text-xs font-medium";
  if (type === "FULL_TIME") return `${base} border-[#d7e4ff] bg-[#eef3ff] text-[#2555F3]`;
  if (type === "PART_TIME") return `${base} border-[#ffe7b8] bg-[#fff8eb] text-[#9a6700]`;
  return `${base} border-[#e5e5e5] bg-[#f5f5f5] text-[#5e5e5e]`;
}

export default function CareersPage() {
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/careers");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load job postings");
        }
        setPostings(data.postings ?? []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load job postings",
        );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <main className="py-12 md:py-16">
      <Container>
        <div className="max-w-3xl">
          <h1 className="font-montaga text-3xl text-[#333333] md:text-4xl">
            Careers at Clinivo
          </h1>
          <p className="mt-3 font-montserrat text-base text-[#5e5e5e]">
            Join our team and help make healthcare more accessible.
          </p>
        </div>

        {error ? (
          <div className="mt-8 rounded-xl border border-dashed border-[#ffd0d0] bg-[#fff6f6] p-4">
            <p className="font-montserrat text-sm text-[#b42318]">{error}</p>
          </div>
        ) : null}

        {loading ? (
          <p className="mt-10 font-montserrat text-sm text-[#5e5e5e]">
            Loading openings...
          </p>
        ) : postings.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-[#e5e5e5] bg-[#fafafa] p-8 text-center">
            <p className="font-montserrat text-sm text-[#5e5e5e]">
              No open positions at the moment. Check back soon.
            </p>
          </div>
        ) : (
          <div className="mt-10 space-y-6">
            {postings.map((posting) => (
              <article
                key={posting.id}
                className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-montserrat text-xl font-semibold text-[#333333]">
                      {posting.title}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={jobTypeBadgeClass(posting.type)}>
                        {formatJobTypeLabel(posting.type)}
                      </span>
                      {posting.isRemote ? (
                        <span className="inline-flex items-center rounded-full border border-[#d7e4ff] bg-[#eef3ff] px-2.5 py-1 font-montserrat text-xs font-medium text-[#2555F3]">
                          Remote
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    asChild
                    className="shrink-0 cursor-pointer rounded-full bg-[#2555F3] font-montserrat text-sm hover:bg-[#1e44c7]"
                  >
                    <Link href={`/careers/${posting.id}/apply`}>Apply</Link>
                  </Button>
                </div>
                {posting.salaryRange ? (
                  <p className="mt-3 font-montserrat text-sm font-medium text-[#333333]">
                    {posting.salaryRange}
                  </p>
                ) : null}
                <p className="mt-4 whitespace-pre-wrap font-montserrat text-sm leading-relaxed text-[#333333]">
                  {posting.description}
                </p>
              </article>
            ))}
          </div>
        )}
      </Container>
    </main>
  );
}
