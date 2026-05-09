import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getPostLoginPath } from "@/lib/post-login-redirect";
import { OnboardingChoiceClient } from "./OnboardingChoiceClient";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (session.user.profileComplete !== false) {
    const nextPath = getPostLoginPath({
      role: session.user.role,
      doctorApprovalStatus: session.user.doctorApprovalStatus ?? null,
      profileComplete: true,
    });
    redirect(nextPath);
  }

  // Doctors who have already chosen the doctor path but haven't finished the
  // doctor signup form should land on that form, not the patient/doctor toggle.
  if (session.user.role === "DOCTOR") {
    redirect("/auth/signup?role=doctor");
  }

  return <OnboardingChoiceClient />;
}
