"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const PROMPT_KEY = "clinivo:push-prompted";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function ChatPushManager() {
  const pathname = usePathname();
  const { status } = useSession();
  const startedRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!pathname?.startsWith("/patient") && !pathname?.startsWith("/doctor")) {
      return;
    }
    if (startedRef.current) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    startedRef.current = true;

    async function setupPush() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        await navigator.serviceWorker.ready;

        if (localStorage.getItem(PROMPT_KEY) === "denied") return;

        let permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
          localStorage.setItem(PROMPT_KEY, permission);
        }

        if (permission !== "granted") return;

        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) return;

        const existing = await registration.pushManager.getSubscription();
        const subscription =
          existing ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          }));

        const json = subscription.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: json.endpoint,
            keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
            userAgent: navigator.userAgent,
          }),
        });
      } catch (err) {
        console.warn("[ChatPushManager] setup failed:", err);
      }
    }

    void setupPush();
  }, [status, pathname]);

  return null;
}
