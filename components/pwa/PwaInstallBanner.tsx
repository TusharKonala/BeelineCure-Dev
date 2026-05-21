"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { X } from "lucide-react";

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

    let cancelled = false;

    async function checkBanner() {
      try {
        const res = await fetch("/api/pwa/dismiss", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { showBanner?: boolean };
        if (!cancelled && data.showBanner) {
          setVisible(true);
        }
      } catch {
        // best-effort
      }
    }

    void checkBanner();

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    }

    function onInstalled() {
      setVisible(false);
      void fetch("/api/pwa/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "installed" }),
      });
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [status, pathname]);

  async function handleInstall() {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
        await fetch("/api/pwa/dismiss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "installed" }),
        });
      }
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  }

  async function handleDismiss() {
    setVisible(false);
    await fetch("/api/pwa/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "dismissed" }),
    });
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Install app"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#e5e5e5] bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <p className="flex-1 font-montserrat text-xs leading-snug text-[#5E5E5E]">
          <span className="font-semibold text-[#333333]">Add to Home Screen</span>{" "}
          for reliable notifications, even when the browser is closed.
        </p>
        <button
          type="button"
          onClick={() => void handleInstall()}
          disabled={installing || !deferredPrompt}
          className="shrink-0 rounded-lg bg-[#2555F3] px-3 py-1.5 font-montserrat text-xs font-semibold text-white transition-colors hover:bg-[#1e44c7] disabled:opacity-60"
        >
          {installing ? "…" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => void handleDismiss()}
          className="shrink-0 rounded-lg p-1 text-[#9A9A9A] hover:bg-[#f5f5f5]"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
