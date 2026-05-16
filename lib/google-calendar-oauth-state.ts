import { createHmac, timingSafeEqual } from "crypto";

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

export type OAuthCalendarSubject =
  | { type: "doctor"; doctorId: string }
  | { type: "admin"; userId: string };

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "NEXTAUTH_SECRET is required for Google Calendar OAuth state signing",
    );
  }
  return secret;
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(value: string): Buffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding =
    padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + padding, "base64");
}

export function signOAuthState(subject: OAuthCalendarSubject): string {
  const payload =
    subject.type === "doctor"
      ? `doctor:${subject.doctorId}.${Date.now()}`
      : `admin:${subject.userId}.${Date.now()}`;
  const payloadB64 = b64url(Buffer.from(payload, "utf8"));
  const mac = createHmac("sha256", getSecret()).update(payloadB64).digest();
  return `${payloadB64}.${b64url(mac)}`;
}

/** @deprecated Use signOAuthState({ type: 'doctor', doctorId }) */
export function signDoctorOAuthState(doctorId: string): string {
  return signOAuthState({ type: "doctor", doctorId });
}

export function verifyOAuthState(
  state: string | null | undefined,
): OAuthCalendarSubject | null {
  if (!state) return null;
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, macB64] = parts;

  let expectedMac: Buffer;
  let givenMac: Buffer;
  try {
    expectedMac = createHmac("sha256", getSecret()).update(payloadB64).digest();
    givenMac = b64urlDecode(macB64);
  } catch {
    return null;
  }
  if (expectedMac.length !== givenMac.length) return null;
  if (!timingSafeEqual(expectedMac, givenMac)) return null;

  let payload: string;
  try {
    payload = b64urlDecode(payloadB64).toString("utf8");
  } catch {
    return null;
  }

  const dot = payload.lastIndexOf(".");
  if (dot === -1) return null;
  const subjectPart = payload.slice(0, dot);
  const tsStr = payload.slice(dot + 1);
  const ts = Number(tsStr);
  if (!Number.isFinite(ts)) return null;
  if (Date.now() - ts > STATE_MAX_AGE_MS) return null;

  if (subjectPart.startsWith("doctor:")) {
    const doctorId = subjectPart.slice("doctor:".length);
    if (!doctorId) return null;
    return { type: "doctor", doctorId };
  }
  if (subjectPart.startsWith("admin:")) {
    const userId = subjectPart.slice("admin:".length);
    if (!userId) return null;
    return { type: "admin", userId };
  }

  // Legacy doctor-only payload: `${doctorId}.${ts}`
  if (!subjectPart) return null;
  return { type: "doctor", doctorId: subjectPart };
}
