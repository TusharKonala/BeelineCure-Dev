import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Container } from "@/components/layout/Container";
import PatientAppointmentsClient from "./PatientAppointmentsClient";

export default function PatientAppointmentsPage() {
  return <PatientAppointmentsPageContent />;
}

async function PatientAppointmentsPageContent() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/auth/signin?callbackUrl=/patient/appointments");
  }

  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <PatientAppointmentsClient />
      </Container>
    </div>
  );
}
