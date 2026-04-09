type RedirectInput = {
  role?: "PATIENT" | "DOCTOR" | "ADMIN" | null;
  doctorApprovalStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
  profileComplete?: boolean | null;
};

export function getPostLoginPath({
  role,
  doctorApprovalStatus,
  profileComplete,
}: RedirectInput): string {
  if (profileComplete === false) return "/onboarding";
  if (role === "DOCTOR") {
    return doctorApprovalStatus === "APPROVED"
      ? "/doctor/overview"
      : "/auth/doctor-pending-approval";
  }
  if (role === "ADMIN") return "/admin/overview";
  return "/patient/overview";
}
