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

function redirectToSettings(status: string): NextResponse {
  const url = new URL("/doctor/settings", getAppBaseUrl());
  url.searchParams.set("calendar", status);
  url.hash = "google-calendar";
  return NextResponse.redirect(url.toString());
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const error = searchParams.get("error");
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (error) {
    console.warn("[google-calendar] OAuth error:", error);
    return redirectToSettings("denied");
  }
  if (!code) {
    return redirectToSettings("error");
  }

  const verified = verifyOAuthState(state);
  if (!verified) {
    return NextResponse.json(
      { error: "Invalid or expired OAuth state" },
      { status: 400 },
    );
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
    return redirectToSettings("error");
  }

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text().catch(() => "");
    console.error(
      "[google-calendar] token exchange failed:",
      tokenResponse.status,
      text,
    );
    return redirectToSettings("error");
  }

  const tokenData = (await tokenResponse.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  } | null;

  if (!tokenData?.access_token || !tokenData?.refresh_token) {
    console.error(
      "[google-calendar] token exchange missing access_token or refresh_token",
      { hasAccess: Boolean(tokenData?.access_token), hasRefresh: Boolean(tokenData?.refresh_token) },
    );
    return redirectToSettings("error");
  }

  const expiresInSec = typeof tokenData.expires_in === "number" ? tokenData.expires_in : 3600;
  const expiresAt = new Date(Date.now() + expiresInSec * 1000);

  try {
    await prisma.doctor.update({
      where: { id: verified.doctorId },
      data: {
        googleCalendarAccessToken: tokenData.access_token,
        googleCalendarRefreshToken: tokenData.refresh_token,
        googleCalendarAccessTokenExpiresAt: expiresAt,
      },
    });
  } catch (err) {
    console.error("[google-calendar] failed to persist doctor tokens:", err);
    return redirectToSettings("error");
  }

  return redirectToSettings("connected");
}
