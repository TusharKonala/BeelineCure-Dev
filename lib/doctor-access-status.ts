import { prisma } from "@/lib/db";
import { getFutureActiveAppointmentsForDoctor } from "@/lib/admin-doctor-deactivation";

export type DoctorAccessStatus =
  | { found: false }
  | {
      found: true;
      doctorId: string;
      isActive: boolean;
      hasRemainingAppointments: boolean;
    };

/**
 * Resolves dashboard access for a logged-in doctor. When `isActive` is false,
 * remaining = future PENDING/CONFIRMED appointments (doctor-tz). Used by the
 * doctor layout to either show a deactivation banner (still has work) or
 * fully lock the doctor out (nothing left to manage).
 */
export async function getDoctorAccessStatus(
  userId: string,
): Promise<DoctorAccessStatus> {
  const doctor = await prisma.doctor.findUnique({
    where: { userId },
    select: { id: true, isActive: true },
  });
  if (!doctor) {
    return { found: false };
  }
  if (doctor.isActive) {
    return {
      found: true,
      doctorId: doctor.id,
      isActive: true,
      hasRemainingAppointments: true,
    };
  }
  const remaining = await getFutureActiveAppointmentsForDoctor(doctor.id);
  return {
    found: true,
    doctorId: doctor.id,
    isActive: false,
    hasRemainingAppointments: remaining.length > 0,
  };
}
