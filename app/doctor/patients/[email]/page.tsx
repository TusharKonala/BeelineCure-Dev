import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import DoctorPatientDetailClient from "./DoctorPatientDetailClient";

type PageProps = {
  params: Promise<{ email: string }>;
};

export default function DoctorPatientDetailPage(props: PageProps) {
  return <DoctorPatientDetailPageContent {...props} />;
}

async function DoctorPatientDetailPageContent({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    const { email } = await params;
    const callbackUrl = `/doctor/patients/${encodeURIComponent(email)}`;
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  if (session.user.role !== UserRole.DOCTOR) {
    redirect("/");
  }

  const { email } = await params;

  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <DoctorPatientDetailClient patientEmail={email} />
      </Container>
    </div>
  );
}
