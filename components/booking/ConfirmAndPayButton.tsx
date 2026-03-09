"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type ConfirmAndPayButtonProps = {
  bookingSessionId: string;
};

export function ConfirmAndPayButton({ bookingSessionId }: ConfirmAndPayButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookingSessionId }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.url) {
        setError(
          typeof json?.error === "string"
            ? json.error
            : "Unable to start payment. Please try again.",
        );
        setIsLoading(false);
        return;
      }

      window.location.href = json.url as string;
    } catch {
      setError("Network error. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-8">
      <Button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className="h-11 w-full cursor-pointer rounded-xl font-montserrat text-sm font-medium sm:h-12 md:text-base"
      >
        {isLoading ? "Redirecting…" : "Confirm & Pay"}
      </Button>
      {error && (
        <p className="mt-3 font-montserrat text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

