"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import {
  CareersJobPostingSummary,
  type JobPostingSummaryData,
} from "@/components/careers-job-posting-summary";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";

const phoneInputClassName =
  "h-11 w-full rounded-xl border border-[#e5e5e5] bg-white px-3 text-sm font-montserrat text-[#333333] shadow-sm placeholder:text-[#5E5E5E]/70 focus-within:border-[#2555F3] focus-within:ring-[3px] focus-within:ring-[#2555F3]/20 [&_.PhoneInputInput]:outline-none";

export default function ApplyPage() {
  const params = useParams();
  const jobId = typeof params.id === "string" ? params.id : "";

  const [posting, setPosting] = useState<JobPostingSummaryData | null>(null);
  const [loadingPosting, setLoadingPosting] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState<string | undefined>();
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [coverNote, setCoverNote] = useState("");
  const [resumeText, setResumeText] = useState("");
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
        const res = await fetch(`/api/careers/${jobId}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load job");
        }
        setPosting(data.posting ?? null);
      } catch {
        setPosting(null);
      } finally {
        setLoadingPosting(false);
      }
    }
    void load();
  }, [jobId]);

  function validatePhoneOnBlur(value: string | undefined) {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) {
      setPhoneError("Phone number is required.");
      return false;
    }
    if (!isValidPhoneNumber(trimmed)) {
      setPhoneError("Please enter a valid phone number.");
      return false;
    }
    setPhoneError(null);
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!jobId) return;
    if (!validatePhoneOnBlur(phone)) return;

    setSubmitting(true);
    setError(null);
    try {
      const candidateTimezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
      const res = await fetch(`/api/careers/${jobId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone!.trim(),
          coverNote: coverNote.trim() || null,
          resumeText: resumeText.trim(),
          resumeUrl: resumeUrl.trim() || null,
          candidateTimezone,
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

  const phoneInvalid = Boolean(phoneError);
  const canSubmit =
    !submitting &&
    !phoneInvalid &&
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    resumeText.trim().length >= 50;

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
          <div className="max-w-xl rounded-xl border border-dashed border-[#ffd0d0] bg-[#fff6f6] p-8">
            <h1 className="font-montaga text-2xl text-[#b42318]">Job not found</h1>
            <Link
              href="/careers"
              className="mt-4 inline-block font-montserrat text-sm text-[#2555F3] hover:underline"
            >
              View careers
            </Link>
          </div>
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
              Thank you for applying to {posting.title}. We will review your
              application and get back to you soon.
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
        <Link
          href="/careers"
          className="font-montserrat text-sm text-[#2555F3] hover:underline"
        >
          ← Back to careers
        </Link>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
          <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm">
            <CareersJobPostingSummary posting={posting} />
          </div>

          <div>
            <h1 className="font-montaga text-2xl text-[#333333] md:text-3xl">
              Apply for this role
            </h1>
            <p className="mt-2 font-montserrat text-sm text-[#5e5e5e]">
              Paste your resume text below (required).
            </p>

            {error ? (
              <div className="mt-6 rounded-xl border border-dashed border-[#ffd0d0] bg-[#fff6f6] p-4">
                <p className="font-montserrat text-sm text-[#b42318]">{error}</p>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="name"
                  className="mb-1 block font-montserrat text-sm font-medium text-[#333333]"
                >
                  Full name <span className="text-red-600">*</span>
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
                  Email <span className="text-red-600">*</span>
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
                  Phone <span className="text-red-600">*</span>
                </label>
                <PhoneInput
                  id="phone"
                  international
                  defaultCountry="US"
                  value={phone}
                  onChange={(value) => {
                    setPhone(value);
                    setPhoneError(null);
                  }}
                  onBlur={() => validatePhoneOnBlur(phone)}
                  className={phoneInputClassName}
                />
                {phoneError ? (
                  <p className="mt-1 font-montserrat text-sm text-red-600">
                    {phoneError}
                  </p>
                ) : null}
              </div>
              <div>
                <label
                  htmlFor="resumeText"
                  className="mb-1 block font-montserrat text-sm font-medium text-[#333333]"
                >
                  Resume (paste text) <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="resumeText"
                  required
                  rows={10}
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste the full text of your resume here..."
                  className="w-full rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 font-montserrat text-sm text-[#333333] outline-none focus:border-[#2555F3] focus:ring-2 focus:ring-[#2555F3]/20"
                />
                <p className="mt-1 font-montserrat text-xs text-[#5e5e5e]">
                  Minimum 50 characters. This is used for our initial review.
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
                  Resume link (optional)
                </label>
                <input
                  id="resumeUrl"
                  type="url"
                  placeholder="https://..."
                  value={resumeUrl}
                  onChange={(e) => setResumeUrl(e.target.value)}
                  className="w-full rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 font-montserrat text-sm text-[#333333] outline-none focus:border-[#2555F3] focus:ring-2 focus:ring-[#2555F3]/20"
                />
                <p className="mt-1 font-montserrat text-xs text-[#5e5e5e]">
                  Optional public link (Google Drive, Dropbox, etc.). Must use
                  https://
                </p>
              </div>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="w-full cursor-pointer rounded-full bg-[#2555F3] font-montserrat text-sm hover:bg-[#1e44c7] sm:w-auto"
              >
                {submitting ? "Submitting..." : "Submit application"}
              </Button>
            </form>
          </div>
        </div>
      </Container>
    </main>
  );
}
