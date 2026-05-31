"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallBanner() {
  const pathname = usePathname();
  const { status } = useSession();
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const dismissedPermanentlyRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!pathname?.startsWith("/patient") && !pathname?.startsWith("/doctor")) {
      return;
    }

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        (navigator as Navigator & { standalone?: boolean }).standalone === true);

    if (!isMobile || isStandalone) return;

    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua);
    setIsIos(ios);

    let cancelled = false;
    let queuedPrompt: BeforeInstallPromptEvent | null = null;
    // Block beforeinstallprompt until dismiss state is loaded (prevents flash).
    dismissedPermanentlyRef.current = true;

    function showFromPrompt(ev: BeforeInstallPromptEvent) {
      setDeferredPrompt(ev);
      setVisible(true);
    }

    async function checkBanner() {
      try {
        const res = await fetch("/api/pwa/dismiss", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { showBanner?: boolean };
        if (cancelled) return;
        if (data.showBanner) {
          dismissedPermanentlyRef.current = false;
          if (queuedPrompt) {
            showFromPrompt(queuedPrompt);
            queuedPrompt = null;
          } else if (ios) {
            setVisible(true);
          }
        } else {
          dismissedPermanentlyRef.current = true;
          queuedPrompt = null;
          setVisible(false);
        }
      } catch {
        // best-effort
      }
    }

    void checkBanner();

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      const ev = e as BeforeInstallPromptEvent;
      if (dismissedPermanentlyRef.current) {
        queuedPrompt = ev;
        return;
      }
      showFromPrompt(ev);
    }

    function onInstalled() {
      setVisible(false);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [status, pathname]);

  async function persistDismiss() {
    const res = await fetch("/api/pwa/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "dismissed" }),
    });
    if (!res.ok) {
      throw new Error("Failed to save dismiss state");
    }
    dismissedPermanentlyRef.current = true;
  }

  async function handleDismiss() {
    try {
      await persistDismiss();
      setVisible(false);
      setDeferredPrompt(null);
    } catch {
      // Keep banner visible if persistence failed
    }
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
        setDeferredPrompt(null);
      } else {
        await handleDismiss();
      }
    } finally {
      setInstalling(false);
    }
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Install app"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#e5e5e5] bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-lg flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="font-montserrat text-xs leading-snug text-[#5E5E5E]">
            <span className="font-semibold text-[#333333]">Install App</span>{" "}
            Install Clinivo for reliable notifications, even when the browser is
            closed.
          </p>
          {isIos && (
            <p className="mt-1 font-montserrat text-[11px] leading-snug text-[#9A9A9A]">
              <span className="font-semibold text-[#5E5E5E]">On iPhone:</span> Add
              Clinivo to your Home Screen to receive notifications when the app is
              closed. Notifications are not available in Safari alone.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => void handleDismiss()}
          className="shrink-0 rounded-lg border border-[#e5e5e5] px-3 py-1.5 font-montserrat text-xs font-medium text-[#5E5E5E] transition-colors hover:bg-[#f5f5f5]"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={() => void handleInstall()}
          disabled={installing || !deferredPrompt}
          className="shrink-0 rounded-lg bg-[#2555F3] px-3 py-1.5 font-montserrat text-xs font-semibold text-white transition-colors hover:bg-[#1e44c7] disabled:opacity-60"
        >
          {installing ? "…" : "Add"}
        </button>
        </div>
      </div>
    </div>
  );
}
