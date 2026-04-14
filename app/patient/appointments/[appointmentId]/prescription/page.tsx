import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Container } from "@/components/layout/Container";
import { prisma } from "@/lib/db";
import { PrescriptionDownloadClient } from "./PrescriptionDownloadClient";

type PageProps = {
  params: Promise<{ appointmentId: string }>;
};

export default async function PatientPrescriptionDownloadPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/auth/signin?callbackUrl=/patient/appointments");
  }

  const { appointmentId } = await params;
  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      email: session.user.email,
    },
    select: {
      id: true,
      patientName: true,
      date: true,
      time: true,
      timezone: true,
      doctor: {
        select: {
          name: true,
        },
      },
      prescription: {
        select: {
          medicines: true,
          generalNotes: true,
        },
      },
    },
  });

  if (!appointment?.prescription) {
    redirect("/patient/appointments");
  }

  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <section className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
          <h1 className="font-montaga text-2xl font-semibold text-[#333333] md:text-3xl">
            Prescription
          </h1>
          <p className="mt-2 font-montserrat text-sm text-[#5E5E5E]">
            Your prescription PDF will be prepared for download.
          </p>
          <div className="mt-6">
            <PrescriptionDownloadClient
              appointmentId={appointment.id}
              doctorName={appointment.doctor.name}
              patientName={appointment.patientName}
              date={appointment.date.toISOString().slice(0, 10)}
              time={appointment.time}
              timezone={appointment.timezone}
              prescription={{
                medicines: appointment.prescription.medicines,
                generalNotes: appointment.prescription.generalNotes,
              }}
            />
          </div>
        </section>
      </Container>
    </div>
  );
}
