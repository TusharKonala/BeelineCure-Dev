"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";

type JobPosting = {
  id: string;
  title: string;
};

export default function ApplyPage() {
  const params = useParams();
  const jobId = typeof params.id === "string" ? params.id : "";

  const [posting, setPosting] = useState<JobPosting | null>(null);
  const [loadingPosting, setLoadingPosting] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [coverNote, setCoverNote] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setLoadingPosting(false);
      return;
    }
    async function load() {
      try {
        const res = await fetch("/api/careers");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load job");
        }
        const found = (data.postings as JobPosting[] | undefined)?.find(
          (p) => p.id === jobId,
        );
        setPosting(found ?? null);
      } catch {
        setPosting(null);
      } finally {
        setLoadingPosting(false);
      }
    }
    void load();
  }, [jobId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!jobId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/careers/${jobId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          coverNote: coverNote.trim() || null,
          resumeUrl: resumeUrl.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to submit application");
      }
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit application",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingPosting) {
    return (
      <main className="py-12 md:py-16">
        <Container>
          <p className="font-montserrat text-sm text-[#5e5e5e]">Loading...</p>
        </Container>
      </main>
    );
  }

  if (!posting) {
    return (
      <main className="py-12 md:py-16">
        <Container>
          <h1 className="font-montaga text-2xl text-[#333333]">
            Job not found
          </h1>
          <p className="mt-2 font-montserrat text-sm text-[#5e5e5e]">
            This position may no longer be open.
          </p>
          <Link
            href="/careers"
            className="mt-4 inline-block font-montserrat text-sm text-[#2555F3] hover:underline"
          >
            Back to careers
          </Link>
        </Container>
      </main>
    );
  }

  if (success) {
    return (
      <main className="py-12 md:py-16">
        <Container>
          <div className="max-w-xl rounded-xl border border-[#d7f2d9] bg-[#effcf0] p-8">
            <h1 className="font-montaga text-2xl text-[#1f7a36]">
              Application submitted
            </h1>
            <p className="mt-2 font-montserrat text-sm text-[#333333]">
              Thank you for applying for {posting.title}. We will review your
              application and get back to you if there is a match.
            </p>
            <Link
              href="/careers"
              className="mt-6 inline-block font-montserrat text-sm text-[#2555F3] hover:underline"
            >
              View other openings
            </Link>
          </div>
        </Container>
      </main>
    );
  }

  return (
    <main className="py-12 md:py-16">
      <Container>
        <div className="max-w-xl">
          <Link
            href="/careers"
            className="font-montserrat text-sm text-[#2555F3] hover:underline"
          >
            ← Back to careers
          </Link>
          <h1 className="mt-4 font-montaga text-3xl text-[#333333]">
            Apply: {posting.title}
          </h1>
          <p className="mt-2 font-montserrat text-sm text-[#5e5e5e]">
            Fill in your details below. All fields are required unless noted.
          </p>

          {error ? (
            <div className="mt-6 rounded-xl border border-dashed border-[#ffd0d0] bg-[#fff6f6] p-4">
              <p className="font-montserrat text-sm text-[#b42318]">{error}</p>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="name"
                className="mb-1 block font-montserrat text-sm font-medium text-[#333333]"
              >
                Full name
              </label>
              <input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 font-montserrat text-sm text-[#333333] outline-none focus:border-[#2555F3] focus:ring-2 focus:ring-[#2555F3]/20"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="mb-1 block font-montserrat text-sm font-medium text-[#333333]"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 font-montserrat text-sm text-[#333333] outline-none focus:border-[#2555F3] focus:ring-2 focus:ring-[#2555F3]/20"
              />
            </div>
            <div>
              <label
                htmlFor="phone"
                className="mb-1 block font-montserrat text-sm font-medium text-[#333333]"
              >
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                required
                placeholder="+1234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 font-montserrat text-sm text-[#333333] outline-none focus:border-[#2555F3] focus:ring-2 focus:ring-[#2555F3]/20"
              />
              <p className="mt-1 font-montserrat text-xs text-[#5e5e5e]">
                Include country code, e.g. +1 for US
              </p>
            </div>
            <div>
              <label
                htmlFor="coverNote"
                className="mb-1 block font-montserrat text-sm font-medium text-[#333333]"
              >
                Cover note (optional)
              </label>
              <textarea
                id="coverNote"
                rows={4}
                value={coverNote}
                onChange={(e) => setCoverNote(e.target.value)}
                className="w-full rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 font-montserrat text-sm text-[#333333] outline-none focus:border-[#2555F3] focus:ring-2 focus:ring-[#2555F3]/20"
              />
            </div>
            <div>
              <label
                htmlFor="resumeUrl"
                className="mb-1 block font-montserrat text-sm font-medium text-[#333333]"
              >
                Resume link
              </label>
              <input
                id="resumeUrl"
                type="url"
                required
                placeholder="https://..."
                value={resumeUrl}
                onChange={(e) => setResumeUrl(e.target.value)}
                className="w-full rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 font-montserrat text-sm text-[#333333] outline-none focus:border-[#2555F3] focus:ring-2 focus:ring-[#2555F3]/20"
              />
              <p className="mt-1 font-montserrat text-xs text-[#5e5e5e]">
                Paste a public link to your resume — Google Drive, Dropbox,
                OneDrive, etc. The link must start with https://
              </p>
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full cursor-pointer rounded-full bg-[#2555F3] font-montserrat text-sm hover:bg-[#1e44c7] sm:w-auto"
            >
              {submitting ? "Submitting..." : "Submit application"}
            </Button>
          </form>
        </div>
      </Container>
    </main>
  );
}
