import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateInDoctorTz, formatTimeInDoctorTz } from "@/lib/timezone-display";
import { PrescriptionForm } from "./PrescriptionForm";

type PageProps = {
  params: Promise<{ appointmentId: string }>;
};

export default async function DoctorAppointmentPrescriptionPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/doctor/appointments");
  }
  if (session.user.role !== UserRole.DOCTOR) {
    redirect("/");
  }

  const { appointmentId } = await params;
  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!doctor) {
    redirect("/doctor/appointments");
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, doctorId: doctor.id },
    select: {
      id: true,
      patientName: true,
      date: true,
      time: true,
      timezone: true,
    },
  });
  if (!appointment) {
    redirect("/doctor/appointments");
  }

  const date = appointment.date.toISOString().slice(0, 10);

  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <section className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
          <h1 className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl">
            Fill Prescription
          </h1>
          <p className="mt-2 font-montserrat text-sm text-[#5E5E5E]">
            Add medicines for {appointment.patientName} on{" "}
            {formatDateInDoctorTz(date, appointment.time, appointment.timezone)} at{" "}
            {formatTimeInDoctorTz(date, appointment.time, appointment.timezone)}.
          </p>

          <div className="mt-6">
            <PrescriptionForm appointmentId={appointment.id} />
          </div>
        </section>
      </Container>
    </div>
  );
}
