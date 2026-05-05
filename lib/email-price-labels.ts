import "server-only";

import {
  coerceSupportedCurrency,
  currencyForTimezone,
  formatPrice,
} from "@/lib/currency";
import { convertCentsAmount } from "@/lib/fx-rates";

/**
 * Builds a base + approx-local price label pair for use in email templates
 * and other server-rendered surfaces. `priceLabel` is always the base amount
 * formatted in `baseCurrency`; `approxLocalPriceLabel` is provided only when
 * the patient's local currency (derived from `patientTimezone`) differs from
 * the base and FX rates are available. On any failure to look up rates, the
 * approx label is silently dropped — emails still ship with the base price.
 */
export async function buildEmailPriceLabels(args: {
  priceCents: number | null | undefined;
  baseCurrency: string | null | undefined;
  patientTimezone: string | null | undefined;
}): Promise<{ priceLabel: string | null; approxLocalPriceLabel: string | null }> {
  const cents = args.priceCents;
  const base = args.baseCurrency;
  if (typeof cents !== "number" || !base) {
    return { priceLabel: null, approxLocalPriceLabel: null };
  }
  const baseCurrency = coerceSupportedCurrency(base);
  const priceLabel = formatPrice(cents, baseCurrency);

  if (!args.patientTimezone) {
    return { priceLabel, approxLocalPriceLabel: null };
  }
  const patientCurrency = currencyForTimezone(args.patientTimezone);
  if (patientCurrency === baseCurrency) {
    return { priceLabel, approxLocalPriceLabel: null };
  }

  try {
    const localCents = await convertCentsAmount(
      cents,
      baseCurrency,
      patientCurrency,
    );
    return {
      priceLabel,
      approxLocalPriceLabel: `(approx ${formatPrice(localCents, patientCurrency)})`,
    };
  } catch (err) {
    console.error("[email-price-labels] FX lookup failed:", err);
    return { priceLabel, approxLocalPriceLabel: null };
  }
}
