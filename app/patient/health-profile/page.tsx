import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { HealthProfileClient } from "./HealthProfileClient";

export default async function PatientHealthProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/auth/signin?callbackUrl=/patient/health-profile");
  }

  const userId = session.user.id;
  const row = await prisma.healthProfile.findUnique({
    where: { userId },
  });

  const initialProfile = row
    ? {
        id: row.id,
        bloodGroup: row.bloodGroup,
        heightCm: row.heightCm,
        weightKg: row.weightKg,
        dateOfBirth: row.dateOfBirth,
        gender: row.gender,
        allergies: row.allergies,
        conditions: row.conditions,
        currentMedications: row.currentMedications,
        pastSurgeries: row.pastSurgeries,
        smokingStatus: row.smokingStatus,
        alcoholUse: row.alcoholUse,
        activityLevel: row.activityLevel,
        emergencyContactName: row.emergencyContactName,
        emergencyContactPhone: row.emergencyContactPhone,
        emergencyContactRelationship: row.emergencyContactRelationship,
        emergencyContact2Name: row.emergencyContact2Name,
        emergencyContact2Phone: row.emergencyContact2Phone,
        emergencyContact2Relationship: row.emergencyContact2Relationship,
      }
    : null;

  return <HealthProfileClient initialProfile={initialProfile} />;
}
