import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getPostLoginPath } from "@/lib/post-login-redirect";

export default async function PostSignInPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/signin");
  }

  const nextPath = getPostLoginPath({
    role: session.user.role,
    doctorApprovalStatus: session.user.doctorApprovalStatus ?? null,
    profileComplete: session.user.profileComplete ?? true,
  });

  redirect(nextPath);
}
