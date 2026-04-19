import { addMinutes } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { google } from "googleapis";
import {
  AppointmentStatus,
  ConsultationType,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

const CLOCK_SKEW_MS = 120_000;

function getAdminEmail(): string | null {
  const raw = process.env.ADMIN_GOOGLE_EMAIL?.trim();
  return raw && raw.length > 0 ? raw : null;
}

function createOAuth2Client(): InstanceType<
  typeof google.auth.OAuth2
> | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret);
}

/**
 * Returns a valid access token for the admin Google account, refreshing and persisting when needed.
 */
export async function getValidAdminAccessToken(): Promise<string | null> {
  const adminEmail = getAdminEmail();
  if (!adminEmail) {
    console.error("[google-calendar] ADMIN_GOOGLE_EMAIL is not set");
    return null;
  }

  const oauth2 = createOAuth2Client();
  if (!oauth2) {
    console.error("[google-calendar] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing");
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: {
      id: true,
      googleCalendarAccessToken: true,
      googleCalendarRefreshToken: true,
      googleCalendarAccessTokenExpiresAt: true,
    },
  });

  if (!user?.googleCalendarRefreshToken) {
    console.error(
      "[google-calendar] No refresh token for admin; sign in with Google as the admin account.",
    );
    return null;
  }

  const now = Date.now();
  const expiresAtMs = user.googleCalendarAccessTokenExpiresAt?.getTime() ?? 0;
  if (
    user.googleCalendarAccessToken &&
    expiresAtMs - CLOCK_SKEW_MS > now
  ) {
    return user.googleCalendarAccessToken;
  }

  oauth2.setCredentials({
    refresh_token: user.googleCalendarRefreshToken,
  });

  try {
    const refreshed = await oauth2.refreshAccessToken();
    const creds = refreshed.credentials;
    const accessToken = creds.access_token;
    if (!accessToken) {
      console.error("[google-calendar] refreshAccessToken returned no access_token");
      return null;
    }
    const newExpiry = creds.expiry_date
      ? new Date(creds.expiry_date)
      : new Date(now + 3600 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        googleCalendarAccessToken: accessToken,
        googleCalendarAccessTokenExpiresAt: newExpiry,
      },
    });

    return accessToken;
  } catch (err) {
    console.error("[google-calendar] Failed to refresh access token:", err);
    return null;
  }
}

function appointmentStartEnd(params: {
  date: Date;
  time: string;
  timezone: string;
  slotDurationMinutes: number;
}): { start: Date; end: Date } {
  const dateStr = params.date.toISOString().slice(0, 10);
  const timeWithSeconds =
    params.time.length === 5 ? `${params.time}:00` : params.time;
  const start = fromZonedTime(
    `${dateStr}T${timeWithSeconds}`,
    params.timezone,
  );
  const end = addMinutes(start, params.slotDurationMinutes);
  return { start, end };
}

function extractMeetUrl(
  data: {
    hangoutLink?: string | null;
    conferenceData?: {
      entryPoints?: { entryPointType?: string | null; uri?: string | null }[];
    } | null;
  } | null | undefined,
): string | null {
  if (!data) return null;
  if (data.hangoutLink) return data.hangoutLink;
  const video = data.conferenceData?.entryPoints?.find(
    (e) => e.entryPointType === "video",
  );
  return video?.uri ?? null;
}

/**
 * Creates a Google Calendar event with Meet for a confirmed online appointment.
 * Idempotent if `googleCalendarEventId` is already set.
 */
export async function createMeetEventForOnlineAppointment(
  appointmentId: string,
): Promise<{ googleMeetUrl: string | null }> {
  const existing = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      googleCalendarEventId: true,
      googleMeetUrl: true,
      consultationType: true,
      status: true,
    },
  });

  if (!existing) {
    console.error("[google-calendar] Appointment not found:", appointmentId);
    return { googleMeetUrl: null };
  }

  if (existing.googleCalendarEventId) {
    return { googleMeetUrl: existing.googleMeetUrl ?? null };
  }

  if (
    existing.consultationType !== ConsultationType.ONLINE ||
    existing.status !== AppointmentStatus.CONFIRMED
  ) {
    return { googleMeetUrl: null };
  }

  const accessToken = await getValidAdminAccessToken();
  if (!accessToken) {
    return { googleMeetUrl: null };
  }

  const oauth2 = createOAuth2Client();
  if (!oauth2) return { googleMeetUrl: null };
  oauth2.setCredentials({ access_token: accessToken });

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      doctor: {
        include: {
          user: { select: { email: true } },
        },
      },
    },
  });

  if (!appointment) return { googleMeetUrl: null };

  const { start, end } = appointmentStartEnd({
    date: appointment.date,
    time: appointment.time,
    timezone: appointment.timezone,
    slotDurationMinutes: appointment.doctor.slotDurationMinutes,
  });

  const attendees: { email: string }[] = [
    { email: appointment.email },
  ];
  const doctorEmail = appointment.doctor.user?.email;
  if (doctorEmail) {
    attendees.push({ email: doctorEmail });
  } else {
    console.warn(
      "[google-calendar] Doctor has no linked user email; Meet invite sent only to patient.",
      { doctorId: appointment.doctorId },
    );
  }

  const calendar = google.calendar({ version: "v3", auth: oauth2 });

  try {
    const res = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: 1,
      requestBody: {
        summary: `Online: ${appointment.patientName} — ${appointment.doctor.name}`,
        description: `Clinivo online consultation (appointment ${appointment.id})`,
        start: {
          dateTime: start.toISOString(),
          timeZone: appointment.timezone,
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: appointment.timezone,
        },
        attendees,
        conferenceData: {
          createRequest: {
            requestId: appointment.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40) || "clinivo-meet",
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      },
    });

    const meetUrl = extractMeetUrl(res.data);
    const eventId = res.data.id;

    if (!eventId) {
      console.error("[google-calendar] events.insert returned no event id");
      return { googleMeetUrl: meetUrl };
    }

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        googleCalendarEventId: eventId,
        ...(meetUrl ? { googleMeetUrl: meetUrl } : {}),
      },
    });

    return { googleMeetUrl: meetUrl ?? null };
  } catch (err) {
    console.error("[google-calendar] events.insert failed:", err);
    return { googleMeetUrl: null };
  }
}

/**
 * Updates Calendar event times when an online appointment is rescheduled.
 */
export async function updateMeetEventForOnlineAppointment(
  appointmentId: string,
): Promise<void> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      doctor: {
        include: {
          user: { select: { email: true } },
        },
      },
    },
  });

  if (!appointment || appointment.consultationType !== ConsultationType.ONLINE) {
    return;
  }

  if (!appointment.googleCalendarEventId) {
    await createMeetEventForOnlineAppointment(appointmentId);
    return;
  }

  const accessToken = await getValidAdminAccessToken();
  if (!accessToken) return;

  const oauth2 = createOAuth2Client();
  if (!oauth2) return;
  oauth2.setCredentials({ access_token: accessToken });

  const { start, end } = appointmentStartEnd({
    date: appointment.date,
    time: appointment.time,
    timezone: appointment.timezone,
    slotDurationMinutes: appointment.doctor.slotDurationMinutes,
  });

  const attendees: { email: string }[] = [{ email: appointment.email }];
  const doctorEmail = appointment.doctor.user?.email;
  if (doctorEmail) attendees.push({ email: doctorEmail });

  const calendar = google.calendar({ version: "v3", auth: oauth2 });

  try {
    const res = await calendar.events.patch({
      calendarId: "primary",
      eventId: appointment.googleCalendarEventId,
      conferenceDataVersion: 1,
      requestBody: {
        start: {
          dateTime: start.toISOString(),
          timeZone: appointment.timezone,
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: appointment.timezone,
        },
        attendees,
      },
    });

    const meetUrl = extractMeetUrl(res.data);
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        ...(meetUrl ? { googleMeetUrl: meetUrl } : {}),
      },
    });
  } catch (err) {
    console.error("[google-calendar] events.patch failed:", err);
  }
}

/**
 * Deletes the Google Calendar event when an online appointment is cancelled.
 */
export async function deleteMeetCalendarEvent(eventId: string | null): Promise<void> {
  if (!eventId) return;

  const accessToken = await getValidAdminAccessToken();
  if (!accessToken) return;

  const oauth2 = createOAuth2Client();
  if (!oauth2) return;
  oauth2.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: "v3", auth: oauth2 });

  try {
    await calendar.events.delete({
      calendarId: "primary",
      eventId,
    });
  } catch (err) {
    console.error("[google-calendar] events.delete failed:", err);
  }
}
