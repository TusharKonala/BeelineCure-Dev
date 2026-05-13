import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import AdminNotificationsClient from "./AdminNotificationsClient";

export default function AdminNotificationsPage() {
  return <AdminNotificationsPageContent />;
}

async function AdminNotificationsPageContent() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/admin/notifications");
  }
  if (session.user.role !== UserRole.ADMIN) {
    redirect("/");
  }

  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <AdminNotificationsClient />
      </Container>
    </div>
  );
}
