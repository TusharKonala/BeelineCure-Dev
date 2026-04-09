import type { DoctorApprovalStatus, UserRole } from "@/generated/prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      doctorApprovalStatus?: DoctorApprovalStatus | null;
      profileComplete?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: UserRole;
    doctorApprovalStatus?: DoctorApprovalStatus | null;
    profileComplete?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    doctorApprovalStatus?: DoctorApprovalStatus | null;
    profileComplete?: boolean;
  }
}
