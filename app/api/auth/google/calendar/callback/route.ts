import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyOAuthState } from "@/lib/google-calendar-oauth-state";

function getAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000"
  );
}

function redirectAfterOAuth(
  subject: "doctor" | "admin",
  status: string,
): NextResponse {
  const path =
    subject === "admin" ? "/admin/settings" : "/doctor/settings";
  const url = new URL(path, getAppBaseUrl());
  url.searchParams.set("calendar", status);
  return NextResponse.redirect(url.toString());
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const error = searchParams.get("error");
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const verified = verifyOAuthState(state);
  const subjectType = verified?.type ?? "doctor";

  if (error) {
    console.warn("[google-calendar] OAuth error:", error);
    return redirectAfterOAuth(subjectType, "denied");
  }
  if (!code) {
    return redirectAfterOAuth(subjectType, "error");
  }

  if (!verified) {
    return redirectAfterOAuth("doctor", "error");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Google OAuth credentials are not configured" },
      { status: 500 },
    );
  }

  const redirectUri = `${getAppBaseUrl().replace(/\/$/, "")}/api/auth/google/calendar/callback`;

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });
  } catch (err) {
    console.error("[google-calendar] token exchange network error:", err);
    return redirectAfterOAuth(verified.type, "error");
  }

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text().catch(() => "");
    console.error(
      "[google-calendar] token exchange failed:",
      tokenResponse.status,
      text,
    );
    return redirectAfterOAuth(verified.type, "error");
  }

  const tokenData = (await tokenResponse.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  } | null;

  if (!tokenData?.access_token || !tokenData?.refresh_token) {
    console.error(
      "[google-calendar] token exchange missing access_token or refresh_token",
      {
        hasAccess: Boolean(tokenData?.access_token),
        hasRefresh: Boolean(tokenData?.refresh_token),
      },
    );
    return redirectAfterOAuth(verified.type, "error");
  }

  const expiresInSec =
    typeof tokenData.expires_in === "number" ? tokenData.expires_in : 3600;
  const expiresAt = new Date(Date.now() + expiresInSec * 1000);

  const tokenFields = {
    googleCalendarAccessToken: tokenData.access_token,
    googleCalendarRefreshToken: tokenData.refresh_token,
    googleCalendarAccessTokenExpiresAt: expiresAt,
  };

  try {
    if (verified.type === "admin") {
      await prisma.user.update({
        where: { id: verified.userId },
        data: tokenFields,
      });
    } else {
      await prisma.doctor.update({
        where: { id: verified.doctorId },
        data: tokenFields,
      });
    }
  } catch (err) {
    console.error("[google-calendar] failed to persist tokens:", err);
    return redirectAfterOAuth(verified.type, "error");
  }

  return redirectAfterOAuth(verified.type, "connected");
}
