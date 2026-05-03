import {
  DoctorApprovalStatus,
  type Prisma,
} from "@/generated/prisma/client";

/**
 * Patient-facing doctor discovery: require `isActive` and never treat activity alone
 * as enough—account-backed rows must be APPROVED; seeded catalog rows have `userId` null.
 */
export const publicDoctorWhere: Prisma.DoctorWhereInput = {
  isActive: true,
  OR: [{ userId: null }, { approvalStatus: DoctorApprovalStatus.APPROVED }],
};

/** Same rules as `publicDoctorWhere`, scoped to one id (booking, slots, checkout, etc.). */
export function publicDoctorByIdWhere(
  doctorId: string,
): Prisma.DoctorWhereInput {
  return {
    id: doctorId,
    isActive: true,
    OR: [{ userId: null }, { approvalStatus: DoctorApprovalStatus.APPROVED }],
  };
}
