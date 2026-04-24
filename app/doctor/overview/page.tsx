import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/client";
import { DoctorOverviewClient } from "./DoctorOverviewClient";

export default async function DoctorOverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== UserRole.DOCTOR) {
    redirect("/auth/signin");
  }

  return <DoctorOverviewClient />;
}
