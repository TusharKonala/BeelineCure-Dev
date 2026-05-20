import webpush from "web-push";
import { prisma } from "@/lib/db";

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) {
    throw new Error("[web-push] VAPID keys are required");
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:support@clinivo.com",
    publicKey,
    privateKey,
  );
  vapidConfigured = true;
}

export type WebPushPayload = {
  title: string;
  body: string;
  url: string;
};

export async function sendPushToUser(userId: string, payload: WebPushPayload) {
  ensureVapid();

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const staleIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
        sent += 1;
      } catch (err: unknown) {
        failed += 1;
        const statusCode =
          err && typeof err === "object" && "statusCode" in err
            ? Number((err as { statusCode?: number }).statusCode)
            : null;
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(sub.id);
        }
      }
    }),
  );

  if (staleIds.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: staleIds } },
    });
  }

  return { sent, failed };
}
