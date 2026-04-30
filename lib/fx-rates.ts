import {
  coerceSupportedCurrency,
  isSupportedCurrency,
  type SupportedCurrency,
} from "@/lib/currency";
import { fetchExchangeRatesForBase } from "@/lib/exchange-rate-api";

type RatesCacheEntry = {
  rates: Record<string, number>;
  expiresAtMs: number;
};

const RATES_TTL_MS = 3 * 60 * 60 * 1000;
const ratesCache = new Map<SupportedCurrency, RatesCacheEntry>();

async function getRates(base: SupportedCurrency): Promise<Record<string, number>> {
  const now = Date.now();
  const cached = ratesCache.get(base);
  if (cached && cached.expiresAtMs > now) {
    return cached.rates;
  }
  const rates = await fetchExchangeRatesForBase(base);
  ratesCache.set(base, { rates, expiresAtMs: now + RATES_TTL_MS });
  return rates;
}

export async function convertCentsAmount(
  amountCents: number,
  fromCurrencyRaw: string,
  toCurrency: SupportedCurrency,
): Promise<number> {
  const fromUpper = fromCurrencyRaw.trim().toUpperCase();
  const fromCurrency = isSupportedCurrency(fromUpper)
    ? fromUpper
    : coerceSupportedCurrency(fromUpper);
  if (fromCurrency === toCurrency) return amountCents;
  const rates = await getRates(fromCurrency);
  const rate = rates[toCurrency];
  if (!rate || rate <= 0) {
    throw new Error(
      `Missing conversion rate from ${fromCurrency} to ${toCurrency}`,
    );
  }
  return Math.round(amountCents * rate);
}

export function clearFxRatesCacheForTests() {
  ratesCache.clear();
}
