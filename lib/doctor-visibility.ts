import {
  DoctorApprovalStatus,
  type Prisma,
} from "@/generated/prisma/client";

/** Doctors visible for public listing and new bookings: seeded (no account) or approved account-backed. */
export const publicDoctorWhere: Prisma.DoctorWhereInput = {
  isActive: true,
  OR: [{ userId: null }, { approvalStatus: DoctorApprovalStatus.APPROVED }],
};

export function publicDoctorByIdWhere(
  doctorId: string,
): Prisma.DoctorWhereInput {
  return {
    id: doctorId,
    isActive: true,
    OR: [{ userId: null }, { approvalStatus: DoctorApprovalStatus.APPROVED }],
  };
}
