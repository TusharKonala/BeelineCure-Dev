import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import DoctorPrescriptionsClient from "./DoctorPrescriptionsClient";

export default function DoctorPrescriptionsPage() {
  return <DoctorPrescriptionsPageContent />;
}

async function DoctorPrescriptionsPageContent() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/doctor/prescriptions");
  }
  if (session.user.role !== UserRole.DOCTOR) {
    redirect("/");
  }

  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <DoctorPrescriptionsClient />
      </Container>
    </div>
  );
}
