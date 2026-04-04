"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/Container";

type CancelUiState =
  | "idle"
  | "success"
  | "invalid_link"
  | "already_cancelled"
  | "error";

function CancelContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<CancelUiState>("idle");
  const [isCancelling, setIsCancelling] = useState(false);
  const [hasCheckedStatus, setHasCheckedStatus] = useState(false);

  const appointmentId = useMemo(
    () => searchParams.get("appointmentId") ?? "",
    [searchParams],
  );
  const token = useMemo(
    () => searchParams.get("token") ?? "",
    [searchParams],
  );

  const canSubmit = appointmentId.length > 0 && token.length > 0;

  useEffect(() => {
    if (!canSubmit) {
      setHasCheckedStatus(true);
      return;
    }

    fetch(
      `/api/cancel-appointment?appointmentId=${encodeURIComponent(
        appointmentId,
      )}&token=${encodeURIComponent(token)}`,
    )
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as
          | { status?: string }
          | null;

        const nextState = json?.status;
        if (nextState === "already_cancelled" || nextState === "invalid_link") {
          setState(nextState);
          return;
        }

        if (nextState !== "valid") {
          setState("error");
        }
      })
      .catch(() => setState("error"))
      .finally(() => setHasCheckedStatus(true));
  }, [appointmentId, token, canSubmit]);

  const onConfirmCancel = async () => {
    if (!canSubmit || isCancelling) return;
    setIsCancelling(true);
    try {
      const res = await fetch("/api/cancel-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, token }),
      });

      const json = (await res.json().catch(() => null)) as
        | { status?: string }
        | null;

      const nextState = json?.status;
      if (
        nextState === "success" ||
        nextState === "already_cancelled" ||
        nextState === "invalid_link"
      ) {
        setState(nextState);
        return;
      }

      setState("error");
    } catch {
      setState("error");
    } finally {
      setIsCancelling(false);
    }
  };

  const title = (() => {
    switch (state) {
      case "success":
        return "Appointment Cancelled";
      case "already_cancelled":
        return "Already Cancelled";
      case "invalid_link":
        return "Invalid Cancellation Link";
      case "error":
        return "Cancellation Error";
      default:
        return "Cancel Appointment";
    }
  })();

  const message = (() => {
    switch (state) {
      case "success":
        return "Your appointment has been cancelled.";
      case "already_cancelled":
        return "This appointment has already been cancelled.";
      case "invalid_link":
        return "This cancellation link is invalid or expired.";
      case "error":
        return "We could not cancel your appointment. Please try again.";
      default:
        if (canSubmit && !hasCheckedStatus) {
          return "Checking your cancellation link...";
        }
        return "Are you sure you want to cancel this appointment?";
    }
  })();

  return (
    <div className="w-full bg-[#fafafa] py-10 md:py-14 lg:py-16">
      <Container>
        <section className="mx-auto max-w-xl">
          <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
            <h1 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
              {title}
            </h1>
            <p className="mt-4 font-montserrat text-sm text-[#5E5E5E] md:text-base">
              {message}
            </p>

            {state === "idle" && canSubmit && hasCheckedStatus && (
              <div className="mt-8">
                <Button
                  disabled={isCancelling}
                  onClick={onConfirmCancel}
                  className="h-11 w-full cursor-pointer rounded-xl font-montserrat text-sm font-medium sm:h-12 md:text-base"
                >
                  {isCancelling ? "Cancelling…" : "Confirm Cancel"}
                </Button>
              </div>
            )}

            {state === "success" && (
              <div className="mt-8">
                <Button
                  asChild
                  className="h-11 w-full cursor-pointer rounded-xl font-montserrat text-sm font-medium sm:h-12 md:text-base"
                >
                  <Link href="/book-appointment">Book a new appointment</Link>
                </Button>
              </div>
            )}

            {state === "idle" && !canSubmit && (
              <div className="mt-8">
                <p className="font-montserrat text-sm text-red-600">
                  This cancellation link is missing required parameters.
                </p>
              </div>
            )}
          </div>
        </section>
      </Container>
    </div>
  );
}

export default function CancelPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full bg-[#fafafa] py-10 md:py-14 lg:py-16">
          <Container>
            <section className="mx-auto max-w-xl">
              <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
                <h1 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
                  Loading cancellation…
                </h1>
                <p className="mt-4 font-montserrat text-sm text-[#5E5E5E] md:text-base">
                  Please wait.
                </p>
              </div>
            </section>
          </Container>
        </div>
      }
    >
      <CancelContent />
    </Suspense>
  );
}
