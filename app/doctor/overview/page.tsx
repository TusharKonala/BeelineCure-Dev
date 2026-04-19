import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@/generated/prisma/client";
import { DoctorOverviewClient } from "./DoctorOverviewClient";

export default async function DoctorOverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== UserRole.DOCTOR) {
    redirect("/auth/signin");
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    select: { googleCalendarRefreshToken: true },
  });

  const connected = Boolean(doctor?.googleCalendarRefreshToken);

  return <DoctorOverviewClient connected={connected} />;
}
