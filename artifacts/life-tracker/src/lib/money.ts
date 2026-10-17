import type { Currency } from "../state/LifeContext";

export async function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency,
): Promise<number> {
  if (from === to) return amount;
  const response = await fetch(`https://api.frankfurter.dev/v2/rate/${from}/${to}`);
  if (!response.ok) throw new Error("Currency conversion is unavailable right now.");
  const payload = (await response.json()) as { rate?: number };
  if (typeof payload.rate !== "number" || !Number.isFinite(payload.rate)) {
    throw new Error(`A ${from} to ${to} rate was not returned.`);
  }
  return Math.round(amount * payload.rate * 100) / 100;
}

