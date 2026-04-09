import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    if (req.nextUrl.pathname.startsWith("/patient") && token?.profileComplete === false) {
      const onboardingUrl = new URL("/onboarding", req.url);
      return NextResponse.redirect(onboardingUrl);
    }
  },
  {
    pages: {
      signIn: "/auth/signin",
    },
  },
);

export const config = {
  matcher: ["/patient/:path*"],
};
