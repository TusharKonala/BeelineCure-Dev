import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HeartPulse } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Container } from "@/components/layout/Container";
import { computeAgeYears, computeBmi } from "@/lib/health-profile-metrics";

function truncate(s: string | null, max: number): string {
  if (!s?.trim()) return "";
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

export default async function PatientOverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/auth/signin?callbackUrl=/patient/overview");
  }

  const userId = session.user.id;
  const healthProfile = await prisma.healthProfile.findUnique({
    where: { userId },
  });

  const snapshotAge = healthProfile?.dateOfBirth
    ? computeAgeYears(healthProfile.dateOfBirth)
    : null;
  const snapshotBmi =
    healthProfile?.heightCm != null &&
    healthProfile?.weightKg != null &&
    healthProfile.heightCm > 0 &&
    healthProfile.weightKg > 0
      ? computeBmi(healthProfile.heightCm, healthProfile.weightKg)
      : null;

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
          <p className="mt-2 font-montserrat text-sm text-[#5E5E5E]">
            Welcome back. Here&apos;s a quick snapshot of your account.
          </p>

          <div className="mt-8">
            {!healthProfile ? (
              <div className="rounded-xl border border-dashed border-[#2555F3]/40 bg-[#f5f8ff] p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2555F3]/10 text-[#2555F3]">
                      <HeartPulse className="size-5" aria-hidden />
                    </div>
                    <div>
                      <p className="font-montserrat text-sm font-semibold text-[#333333]">
                        Complete your health profile
                      </p>
                      <p className="mt-1 max-w-xl font-montserrat text-sm text-[#5E5E5E]">
                        Add vitals, medical history, lifestyle, and emergency
                        contacts so your care team has the essentials on file.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/patient/health-profile"
                    className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#2555F3] px-5 font-montserrat text-sm font-medium text-white transition-colors hover:bg-[#1e44c7]"
                  >
                    Add health profile
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="font-montserrat text-sm font-semibold text-[#333333]">
                      Health snapshot
                    </h2>
                    <dl className="mt-3 space-y-2 font-montserrat text-sm text-[#333333]">
                      {(snapshotAge != null ||
                        healthProfile.gender?.trim() ||
                        snapshotBmi != null) && (
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-[#5E5E5E]">
                            Vitals
                          </dt>
                          <dd className="mt-0.5">
                            {[
                              snapshotAge != null ? `Age ${snapshotAge}` : null,
                              healthProfile.gender?.trim() || null,
                              snapshotBmi != null ? `BMI ${snapshotBmi}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-[#5E5E5E]">
                          Blood group
                        </dt>
                        <dd className="mt-0.5">
                          {healthProfile.bloodGroup?.trim() || "—"}
                        </dd>
                      </div>
                      {(healthProfile.allergies?.trim() ||
                        healthProfile.conditions?.trim() ||
                        healthProfile.currentMedications?.trim()) && (
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-[#5E5E5E]">
                            Medical
                          </dt>
                          <dd className="mt-0.5 whitespace-pre-wrap">
                            {[
                              healthProfile.allergies?.trim()
                                ? `Allergies: ${truncate(healthProfile.allergies, 120)}`
                                : null,
                              healthProfile.conditions?.trim()
                                ? `Conditions: ${truncate(healthProfile.conditions, 120)}`
                                : null,
                              healthProfile.currentMedications?.trim()
                                ? `Meds: ${truncate(healthProfile.currentMedications, 120)}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join("\n")}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                  <Link
                    href="/patient/health-profile"
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-[#e5e5e5] bg-white px-4 font-montserrat text-sm font-medium text-[#2555F3] shadow-sm transition-colors hover:bg-[#f5f5f5]"
                  >
                    View full profile
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </Container>
    </div>
  );
}
