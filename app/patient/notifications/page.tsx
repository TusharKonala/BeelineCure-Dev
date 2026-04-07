import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Container } from "@/components/layout/Container";
import PatientNotificationsClient from "./PatientNotificationsClient";

export default async function PatientNotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/patient/notifications");
  }

  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <PatientNotificationsClient />
      </Container>
    </div>
  );
}
