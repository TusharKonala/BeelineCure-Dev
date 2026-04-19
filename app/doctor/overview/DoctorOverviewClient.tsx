"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, AlertTriangle, Calendar } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";

type DoctorOverviewClientProps = {
  connected: boolean;
};

export function DoctorOverviewClient({ connected }: DoctorOverviewClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const calendarStatus = searchParams.get("calendar");
  const [disconnectPending, setDisconnectPending] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const banner = useMemo(() => {
    if (calendarStatus === "connected") {
      return {
        tone: "success" as const,
        message: "Google Calendar connected. Online appointments will include a Meet link.",
      };
    }
    if (calendarStatus === "denied") {
      return {
        tone: "warning" as const,
        message: "Google Calendar connection was cancelled. You can try again any time.",
      };
    }
    if (calendarStatus === "error") {
      return {
        tone: "error" as const,
        message: "We could not finish connecting Google Calendar. Please try again.",
      };
    }
    return null;
  }, [calendarStatus]);

  async function onDisconnect() {
    setDisconnectPending(true);
    setDisconnectError(null);
    try {
      const res = await fetch("/api/doctor/google-calendar/disconnect", {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setDisconnectError(data.error ?? "Unable to disconnect. Please try again.");
        return;
      }
      router.refresh();
    } finally {
      setDisconnectPending(false);
    }
  }

  function onConnect() {
    window.location.href = "/api/auth/google/calendar/connect";
  }

  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <section className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
          <h1
            style={{
              WebkitTextStroke: "0.08px #333333",
              WebkitTextFillColor: "#333333",
            }}
            className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl"
          >
            Overview
          </h1>

          {banner && (
            <div
              className={`mt-6 flex items-start gap-2 rounded-xl border px-3 py-2 font-montserrat text-sm ${
                banner.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : banner.tone === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {banner.tone === "success" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              )}
              <p>{banner.message}</p>
            </div>
          )}

          <div className="mt-8 rounded-xl border border-[#e5e5e5] bg-white p-5 md:p-6">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#2555F3]/10 text-[#2555F3]">
                <Calendar className="size-5" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-montaga text-lg font-semibold text-[#333333] md:text-xl">
                    Google Calendar
                  </h2>
                  {connected ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-montserrat text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="size-3" />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-[#fafafa] px-2 py-0.5 font-montserrat text-xs font-medium text-[#5E5E5E]">
                      Not connected
                    </span>
                  )}
                </div>
                <p className="mt-2 font-montserrat text-sm leading-relaxed text-[#5E5E5E]">
                  Connect your Google Calendar so patients of online consultations
                  automatically get a Google Meet link on their confirmation and
                  reminder emails. You and the patient will also receive a Calendar
                  invite for every online appointment.
                </p>

                {disconnectError && (
                  <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-montserrat text-sm text-red-800">
                    {disconnectError}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {connected ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void onDisconnect()}
                      disabled={disconnectPending}
                      className="cursor-pointer h-10 rounded-xl border-[#e5e5e5] bg-white font-montserrat text-sm font-medium text-[#333333] hover:bg-[#fafafa]"
                    >
                      {disconnectPending ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={onConnect}
                      className="cursor-pointer h-10 rounded-xl bg-[#2555F3] font-montserrat text-sm font-medium hover:bg-[#1e44c7]"
                    >
                      Connect Google Calendar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </Container>
    </div>
  );
}
