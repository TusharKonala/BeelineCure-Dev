import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@/generated/prisma/client";
import { coerceSupportedCurrency } from "@/lib/currency";
import { parsePriceMap } from "@/lib/doctor-pricing";
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
      phone: true,
      specialization: true,
      qualification: true,
      licenseNumber: true,
      yearsExperience: true,
      bio: true,
      profilePhotoUrl: true,
      timezone: true,
      currency: true,
      consultationPriceCentsByDuration: true,
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
        phone: doctor.phone,
        specialization: doctor.specialization,
        qualification: doctor.qualification,
        licenseNumber: doctor.licenseNumber,
        yearsExperience: doctor.yearsExperience,
        bio: doctor.bio,
        profilePhotoUrl: doctor.profilePhotoUrl,
        timezone: doctor.timezone,
        currency: coerceSupportedCurrency(doctor.currency),
        consultationPriceCentsByDuration: parsePriceMap(
          doctor.consultationPriceCentsByDuration,
        ),
      }}
      connected={Boolean(doctor.googleCalendarRefreshToken)}
    />
  );
}
