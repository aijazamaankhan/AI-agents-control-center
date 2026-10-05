/**
 * Pricing math. Prices are USD per 1M tokens with at most 6 decimals, handled as integer
 * micro-dollars (bigint) so costs are exact: tokens × micro-USD-per-1M = 1e-12 USD units.
 *
 * Token semantics (docs/API.md): `input_tokens` are uncached input tokens, `cached_tokens`
 * are input tokens served from the provider's cache (billed at the cached price).
 */

export const COST_SCALE = 12; // decimals stored in cost_usd
const MICROS = 1_000_000n;

function normalizePart(value: string | null | undefined): string {
  const v = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  return v || "unknown";
}

/** Matching key for a provider + model, e.g. ("Anthropic", "Claude Sonnet") → "anthropic/claude-sonnet". */
export function priceKeyOf(provider: string | null | undefined, model: string | null | undefined) {
  return `${normalizePart(provider)}/${normalizePart(model)}`;
}

const USD_PATTERN = /^\d{1,6}(\.\d{1,6})?$/;

/** "3.75" → 3750000n (micro-dollars). Returns null for anything that isn't a plain amount. */
export function parseUsdToMicros(value: string): bigint | null {
  const v = value.trim();
  if (!USD_PATTERN.test(v)) return null;
  const [whole = "0", frac = ""] = v.split(".");
  return BigInt(whole) * MICROS + BigInt(frac.padEnd(6, "0"));
}

/** 3750000n → "3.75" (at least 2 decimals). */
export function microsToUsd(micros: bigint): string {
  const whole = micros / MICROS;
  const frac = (micros % MICROS).toString().padStart(6, "0").replace(/0+$/, "").padEnd(2, "0");
  return `${whole}.${frac}`;
}

export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

export interface PriceMicros {
  input: bigint;
  output: bigint;
  cached: bigint;
}

/** Exact cost as a decimal string with 12 decimals, e.g. "0.045000000000". */
export function computeCost(tokens: TokenCounts, price: PriceMicros): string {
  const units =
    BigInt(tokens.inputTokens) * price.input +
    BigInt(tokens.outputTokens) * price.output +
    BigInt(tokens.cachedTokens) * price.cached;
  const scale = 10n ** BigInt(COST_SCALE);
  return `${units / scale}.${(units % scale).toString().padStart(COST_SCALE, "0")}`;
}

/** Display a USD amount: "$12.34", "$0.0042", "<$0.0001", "$0.00". */
export function formatUsd(amount: number): string {
  if (amount === 0) return "$0.00";
  if (amount < 0.0001) return "<$0.0001";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
