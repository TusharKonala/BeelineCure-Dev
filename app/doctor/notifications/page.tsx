import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import DoctorNotificationsClient from "./DoctorNotificationsClient";

export default function DoctorNotificationsPage() {
  return <DoctorNotificationsPageContent />;
}

async function DoctorNotificationsPageContent() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/doctor/notifications");
  }
  if (session.user.role !== UserRole.DOCTOR) {
    redirect("/");
  }

  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <DoctorNotificationsClient />
      </Container>
    </div>
  );
}
