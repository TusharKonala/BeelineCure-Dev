import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Container } from "@/components/layout/Container";
import PatientAppointmentsClient, {
  type PatientAppointmentItem,
} from "./PatientAppointmentsClient";

export default function PatientAppointmentsPage() {
  return <PatientAppointmentsPageContent />;
}

async function PatientAppointmentsPageContent() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    redirect("/auth/signin?callbackUrl=/patient/appointments");
  }

  const appointments = await prisma.appointment.findMany({
    where: { email },
    orderBy: [{ date: "desc" }, { time: "desc" }],
    select: {
      id: true,
      doctorId: true,
      cancelToken: true,
      rescheduleToken: true,
      date: true,
      time: true,
      timezone: true,
      consultationType: true,
      status: true,
      doctor: {
        select: {
          name: true,
          specialization: true,
        },
      },
    },
  });

  const items: PatientAppointmentItem[] = appointments.map((a) => ({
    id: a.id,
    doctorId: a.doctorId,
    cancelToken: a.cancelToken,
    rescheduleToken: a.rescheduleToken,
    date: a.date.toISOString().slice(0, 10),
    time: a.time,
    timezone: a.timezone,
    consultationType: a.consultationType,
    status: a.status as PatientAppointmentItem["status"],
    doctor: {
      name: a.doctor.name,
      specialization: a.doctor.specialization,
    },
  }));

  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <PatientAppointmentsClient appointments={items} />
      </Container>
    </div>
  );
}
