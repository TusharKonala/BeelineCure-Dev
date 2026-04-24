import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@/generated/prisma/client";
import { DoctorSettingsClient } from "./DoctorSettingsClient";

export default async function DoctorSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== UserRole.DOCTOR) {
    redirect("/auth/signin");
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      name: true,
      specialization: true,
      licenseNumber: true,
      yearsExperience: true,
      bio: true,
      profilePhotoUrl: true,
      timezone: true,
      consultationPriceCents: true,
      googleCalendarRefreshToken: true,
    },
  });

  if (!doctor) {
    redirect("/doctor/overview");
  }

  return (
    <DoctorSettingsClient
      initialDoctor={{
        id: doctor.id,
        name: doctor.name,
        specialization: doctor.specialization,
        licenseNumber: doctor.licenseNumber,
        yearsExperience: doctor.yearsExperience,
        bio: doctor.bio,
        profilePhotoUrl: doctor.profilePhotoUrl,
        timezone: doctor.timezone,
        consultationPriceCents: doctor.consultationPriceCents,
      }}
      connected={Boolean(doctor.googleCalendarRefreshToken)}
    />
  );
}
