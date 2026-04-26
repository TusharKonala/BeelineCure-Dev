/**
 * Supported ISO 4217 currency codes and helpers for currency display.
 *
 * The list is intentionally small and aligned with the timezones we already
 * surface in the doctor settings dropdown. Stripe supports many more
 * currencies, but a fixed list keeps validation simple and the UI sane.
 */

export const SUPPORTED_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "INR",
  "CAD",
  "AUD",
  "JPY",
  "SGD",
  "AED",
  "ZAR",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_LABELS: Record<SupportedCurrency, string> = {
  USD: "USD - US Dollar",
  EUR: "EUR - Euro",
  GBP: "GBP - British Pound",
  INR: "INR - Indian Rupee",
  CAD: "CAD - Canadian Dollar",
  AUD: "AUD - Australian Dollar",
  JPY: "JPY - Japanese Yen",
  SGD: "SGD - Singapore Dollar",
  AED: "AED - UAE Dirham",
  ZAR: "ZAR - South African Rand",
};

/**
 * Best-effort mapping from an IANA timezone to a default currency. Used to
 * pre-fill the doctor settings dropdown after the doctor picks a timezone.
 *
 * Falls back to USD for any timezone we don't recognise. This is a heuristic,
 * not a source of truth — the doctor can override the choice manually.
 */
export function currencyForTimezone(timezone: string): SupportedCurrency {
  if (!timezone) return "USD";
  const exactMatches: Record<string, SupportedCurrency> = {
    "Asia/Kolkata": "INR",
    "Asia/Calcutta": "INR",
    "Asia/Tokyo": "JPY",
    "Asia/Singapore": "SGD",
    "Asia/Dubai": "AED",
    "Europe/London": "GBP",
    "Africa/Johannesburg": "ZAR",
    "America/Toronto": "CAD",
    "America/Vancouver": "CAD",
    "America/Edmonton": "CAD",
    "America/Halifax": "CAD",
  };
  if (timezone in exactMatches) return exactMatches[timezone]!;

  if (timezone.startsWith("Europe/")) return "EUR";
  if (timezone.startsWith("Australia/")) return "AUD";
  if (timezone.startsWith("America/")) return "USD";
  return "USD";
}

/** True if the given string is a known supported currency. */
export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

/** Coerce a stored DB value to a supported currency, defaulting to USD. */
export function coerceSupportedCurrency(value: unknown): SupportedCurrency {
  if (typeof value === "string") {
    const upper = value.trim().toUpperCase();
    if (isSupportedCurrency(upper)) return upper;
  }
  return "USD";
}

/**
 * Format an integer cents amount in the given currency. JPY and other
 * zero-decimal currencies are handled correctly by Intl.NumberFormat via the
 * `currency` option.
 */
export function formatPrice(
  cents: number,
  currency: SupportedCurrency,
  locale: string = "en-US",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}
