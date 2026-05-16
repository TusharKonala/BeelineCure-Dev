"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";

type ConfirmDetails = {
  jobTitle: string;
  candidateName: string;
  roundNumber: number;
  scheduledAtLabel: string;
  confirmed: boolean;
  meetLink: string | null;
};

function ConfirmContent() {
  const searchParams = useSearchParams();
  const token = useMemo(
    () => searchParams.get("token") ?? "",
    [searchParams],
  );

  const [details, setDetails] = useState<ConfirmDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [meetLink, setMeetLink] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("This confirmation link is invalid.");
      return;
    }

    let cancelled = false;
    void fetch(`/api/careers/interview/confirm?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "This confirmation link is invalid.");
          return;
        }
        setDetails({
          jobTitle: data.jobTitle,
          candidateName: data.candidateName,
          roundNumber: data.roundNumber,
          scheduledAtLabel: data.scheduledAtLabel,
          confirmed: Boolean(data.confirmed),
          meetLink: data.meetLink ?? null,
        });
        if (data.confirmed) {
          setConfirmed(true);
          setMeetLink(data.meetLink ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load interview details.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleConfirm() {
    if (!token) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/careers/interview/confirm?token=${encodeURIComponent(token)}`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Could not confirm interview");
      }
      setConfirmed(true);
      setMeetLink(data.round?.meetLink ?? null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not confirm interview",
      );
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <main className="py-12 md:py-16">
        <Container>
          <p className="font-montserrat text-sm text-[#5e5e5e]">Loading...</p>
        </Container>
      </main>
    );
  }

  if (error && !details) {
    return (
      <main className="py-12 md:py-16">
        <Container>
          <div className="max-w-xl rounded-xl border border-dashed border-[#ffd0d0] bg-[#fff6f6] p-8">
            <h1 className="font-montaga text-2xl text-[#b42318]">
              Invalid link
            </h1>
            <p className="mt-2 font-montserrat text-sm text-[#333333]">{error}</p>
            <Link
              href="/careers"
              className="mt-6 inline-block font-montserrat text-sm text-[#2555F3] hover:underline"
            >
              View careers
            </Link>
          </div>
        </Container>
      </main>
    );
  }

  if (!details) return null;

  if (confirmed) {
    return (
      <main className="py-12 md:py-16">
        <Container>
          <div className="max-w-xl rounded-xl border border-[#d7f2d9] bg-[#effcf0] p-8">
            <h1 className="font-montaga text-2xl text-[#1f7a36]">
              Interview confirmed
            </h1>
            <p className="mt-2 font-montserrat text-sm text-[#333333]">
              Hi {details.candidateName}, your Round {details.roundNumber}{" "}
              interview for <strong>{details.jobTitle}</strong> is confirmed for{" "}
              <strong>{details.scheduledAtLabel}</strong>.
            </p>
            {meetLink ? (
              <p className="mt-4">
                <a
                  href={meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-montserrat text-sm font-medium text-[#2555F3] hover:underline"
                >
                  Join Google Meet
                </a>
              </p>
            ) : (
              <p className="mt-4 font-montserrat text-sm text-[#5e5e5e]">
                Check your email for the meeting link.
              </p>
            )}
            <Link
              href="/careers"
              className="mt-6 inline-block font-montserrat text-sm text-[#2555F3] hover:underline"
            >
              View careers
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
          <h1 className="font-montaga text-3xl text-[#333333]">
            Confirm interview
          </h1>
          <p className="mt-2 font-montserrat text-sm text-[#5e5e5e]">
            Hi {details.candidateName}, please confirm your availability for
            Round {details.roundNumber} — {details.jobTitle}.
          </p>
          <p className="mt-4 font-montserrat text-sm font-medium text-[#333333]">
            Proposed time: {details.scheduledAtLabel}
          </p>
          {error ? (
            <p className="mt-4 font-montserrat text-sm text-[#b42318]">{error}</p>
          ) : null}
          <Button
            type="button"
            disabled={confirming}
            onClick={() => void handleConfirm()}
            className="mt-6 cursor-pointer rounded-full bg-[#2555F3] font-montserrat text-sm hover:bg-[#1e44c7]"
          >
            {confirming ? "Confirming..." : "Confirm availability"}
          </Button>
        </div>
      </Container>
    </main>
  );
}

export default function InterviewConfirmPage() {
  return (
    <Suspense
      fallback={
        <main className="py-12 md:py-16">
          <Container>
            <p className="font-montserrat text-sm text-[#5e5e5e]">Loading...</p>
          </Container>
        </main>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
