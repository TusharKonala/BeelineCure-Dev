import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { getPostLoginPath } from "@/lib/post-login-redirect";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    if (pathname.startsWith("/patient") && token?.profileComplete === false) {
      const onboardingUrl = new URL("/onboarding", req.url);
      return NextResponse.redirect(onboardingUrl);
    }

    if (pathname.startsWith("/doctor")) {
      const role = token?.role;
      const doctorApprovalStatus = token?.doctorApprovalStatus ?? null;
      const profileComplete = token?.profileComplete ?? null;

      if (role !== "DOCTOR") {
        const target = getPostLoginPath({
          role: role ?? null,
          doctorApprovalStatus,
          profileComplete,
        });
        return NextResponse.redirect(new URL(target, req.url));
      }

      if (doctorApprovalStatus !== "APPROVED") {
        return NextResponse.redirect(
          new URL("/auth/doctor-pending-approval", req.url),
        );
      }
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/auth/signin",
    },
  },
);

export const config = {
  matcher: ["/patient/:path*", "/doctor/:path*"],
};
