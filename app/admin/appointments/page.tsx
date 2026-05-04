import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { Container } from "@/components/layout/Container";
import AdminAppointmentsClient from "./AdminAppointmentsClient";

export default async function AdminAppointmentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/admin/appointments");
  }
  if (session.user.role !== UserRole.ADMIN) {
    redirect("/");
  }

  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <AdminAppointmentsClient />
      </Container>
    </div>
  );
}
