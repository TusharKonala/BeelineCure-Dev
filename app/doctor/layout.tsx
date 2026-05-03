import { type ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDoctorAccessStatus } from "@/lib/doctor-access-status";
import { DoctorShell } from "./DoctorShell";

export default async function DoctorLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  // Middleware already guarantees an authenticated DOCTOR with APPROVED status
  // before reaching `/doctor/*`. The DB check below adds the deactivation gate:
  // a deactivated doctor with no remaining work is fully locked out, while one
  // with pending/upcoming appointments still gets read+cancel access.
  if (userId) {
    const access = await getDoctorAccessStatus(userId);
    if (access.found && !access.isActive && !access.hasRemainingAppointments) {
      redirect("/auth/doctor-deactivated");
    }
    const doctorIsActive = access.found ? access.isActive : true;
    return (
      <DoctorShell doctorIsActive={doctorIsActive}>{children}</DoctorShell>
    );
  }

  return <DoctorShell doctorIsActive={true}>{children}</DoctorShell>;
}
