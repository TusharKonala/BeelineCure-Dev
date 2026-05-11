"use client";

import { useEffect, useMemo, useState } from "react";
import { ALLOWED_SLOT_DURATION_MINUTES } from "@/lib/doctor-availability-slots";
import {
  currencyForTimezone,
  formatPrice,
  type SupportedCurrency,
} from "@/lib/currency";
import {
  priceCentsForDuration,
  type ConsultationPriceCentsByDuration,
} from "@/lib/doctor-pricing";
import { convertCentsAmount } from "@/lib/fx-rates";

function patientCurrencyFromTimezone(): SupportedCurrency {
  const timezone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "";
  return currencyForTimezone(timezone);
}

export function ProfileFees({
  priceMap,
  doctorCurrency,
}: {
  priceMap: ConsultationPriceCentsByDuration;
  doctorCurrency: SupportedCurrency;
}) {
  const patientCurrency = useMemo(() => patientCurrencyFromTimezone(), []);
  const [approxByDuration, setApproxByDuration] = useState<
    Partial<Record<(typeof ALLOWED_SLOT_DURATION_MINUTES)[number], string>>
  >({});

  useEffect(() => {
    let cancelled = false;
    async function loadApproxPrices() {
      setApproxByDuration({});
      if (patientCurrency === doctorCurrency) return;
      try {
        const entries = await Promise.all(
          ALLOWED_SLOT_DURATION_MINUTES.map(async (mins) => {
            const doctorCents = priceCentsForDuration(priceMap, mins);
            const patientCents = await convertCentsAmount(
              doctorCents,
              doctorCurrency,
              patientCurrency,
            );
            return [mins, formatPrice(patientCents, patientCurrency)] as const;
          }),
        );
        if (!cancelled) setApproxByDuration(Object.fromEntries(entries));
      } catch {
        // Best-effort only: mirror booking flow and hide approximate prices.
      }
    }
    void loadApproxPrices();
    return () => {
      cancelled = true;
    };
  }, [doctorCurrency, patientCurrency, priceMap]);

  return (
    <div>
      <h2 className="font-montserrat text-xs font-semibold uppercase tracking-wide text-[#777777]">
        Fees
      </h2>
      <ul className="mt-2 grid gap-1.5 font-montserrat text-sm text-[#333333] sm:grid-cols-2">
        {ALLOWED_SLOT_DURATION_MINUTES.map((mins) => {
          const cents = priceCentsForDuration(priceMap, mins);
          const approx = approxByDuration[mins];
          return (
            <li key={mins}>
              {mins} min — {formatPrice(cents, doctorCurrency)}
              {approx ? ` (approx ${approx})` : ""}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 font-montserrat text-xs text-[#5e5e5e]">
        Prices are charged in your doctor&apos;s billing currency (
        {doctorCurrency}
        ).
        {patientCurrency !== doctorCurrency
          ? ` Approximate values use your timezone currency (${patientCurrency}).`
          : ""}
      </p>
    </div>
  );
}
