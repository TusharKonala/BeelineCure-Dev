import { type SupportedCurrency } from "@/lib/currency";

type ExchangeRateApiResponse = {
  result?: string;
  conversion_rates?: Record<string, number>;
};

export function exchangeRateApiKey(): string | null {
  const value =
    process.env.EXCHANGE_RATE_API_KEY ??
    process.env.NEXT_PUBLIC_EXCHANGE_RATE_API_KEY;
  return value && value.trim().length > 0 ? value.trim() : null;
}

export async function fetchExchangeRatesForBase(
  base: SupportedCurrency,
): Promise<Record<string, number>> {
  const apiKey = exchangeRateApiKey();
  if (!apiKey) {
    throw new Error("Missing EXCHANGE_RATE_API_KEY");
  }
  const res = await fetch(
    `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${base}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`FX API request failed (${res.status})`);
  }
  const data = (await res.json()) as ExchangeRateApiResponse;
  if (data.result !== "success" || !data.conversion_rates) {
    throw new Error("FX API response missing conversion rates");
  }
  return data.conversion_rates;
}
