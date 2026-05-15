import { getServerSession } from "next-auth/next";
import { UserRole } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";

export async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Unauthorized" as const, status: 401 as const };
  }
  if (session.user.role !== UserRole.ADMIN) {
    return { error: "Forbidden" as const, status: 403 as const };
  }
  return { session };
}
