import { UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateInDoctorTz, formatTimeInDoctorTz } from "@/lib/timezone-display";
import { Container } from "@/components/layout/Container";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

function consultationLabel(type: "CLINIC" | "ONLINE") {
  return type === "ONLINE" ? "Online" : "Clinic";
}

function badgeClass(kind: "consultation" | "status", value: string) {
  if (kind === "consultation") {
    return value === "Online"
      ? "border-[#2555F3]/30 bg-[#2555F3]/10 text-[#2555F3]"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800";
  }

  switch (value) {
    case "PENDING":
      return "border-amber-500/30 bg-amber-500/10 text-amber-800";
    case "CONFIRMED":
      return "border-[#2555F3]/30 bg-[#2555F3]/10 text-[#2555F3]";
    case "COMPLETED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800";
    case "CANCELLED":
      return "border-red-500/30 bg-red-500/10 text-red-800";
    default:
      return "border-[#e5e5e5] bg-[#fafafa] text-[#333333]";
  }
}

export default async function DoctorAppointmentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/doctor/appointments");
  }
  if (session.user.role !== UserRole.DOCTOR) {
    redirect("/");
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!doctor) {
    redirect("/");
  }

  const appointments = await prisma.appointment.findMany({
    where: { doctorId: doctor.id },
    orderBy: [{ date: "desc" }, { time: "desc" }],
    select: {
      id: true,
      patientName: true,
      email: true,
      phone: true,
      date: true,
      time: true,
      timezone: true,
      consultationType: true,
      status: true,
      notes: true,
    },
  });

  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-2">
            <h1 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
              Appointments
            </h1>
            <p className="font-montserrat text-sm text-[#5E5E5E]">
              View all appointments booked with you.
            </p>
          </div>

          {appointments.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-[#e5e5e5] bg-[#fafafa] p-6 text-center">
              <p className="font-montserrat text-sm font-medium text-[#333333]">
                No appointments yet.
              </p>
              <p className="mt-2 font-montserrat text-sm text-[#5E5E5E]">
                Your booked appointments will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid w-full grid-cols-1 gap-4">
              {appointments.map((a) => {
                const consultation = consultationLabel(a.consultationType);
                const dateStr = a.date.toISOString().slice(0, 10);
                return (
                  <div
                    key={a.id}
                    className="rounded-xl border border-[#e5e5e5] bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-montaga text-lg font-semibold text-[#333333]">
                          {a.patientName}
                        </p>
                        <p className="mt-1 font-montserrat text-sm text-[#5E5E5E]">{a.email}</p>
                        <p className="mt-1 font-montserrat text-sm text-[#5E5E5E]">{a.phone}</p>
                        <div className="mt-3 flex flex-col gap-1 font-montserrat text-sm text-[#333333] min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:items-center">
                          <span>
                            <span className="font-medium">Date:</span>{" "}
                            {formatDateInDoctorTz(dateStr, a.time, a.timezone)}
                          </span>
                          <span
                            className="hidden text-[#e5e5e5] min-[400px]:mx-2 min-[400px]:inline"
                            aria-hidden
                          >
                            |
                          </span>
                          <span>
                            <span className="font-medium">Time:</span>{" "}
                            {formatTimeInDoctorTz(dateStr, a.time, a.timezone)}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 font-montserrat text-xs font-medium ${badgeClass(
                            "consultation",
                            consultation,
                          )}`}
                        >
                          {consultation}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-1 font-montserrat text-xs font-medium ${badgeClass(
                            "status",
                            a.status,
                          )}`}
                        >
                          {a.status}
                        </span>
                      </div>
                    </div>

                    {a.notes && (
                      <p className="mt-3 whitespace-pre-wrap font-montserrat text-sm text-[#333333]">
                        <span className="font-medium">Notes:</span> {a.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
