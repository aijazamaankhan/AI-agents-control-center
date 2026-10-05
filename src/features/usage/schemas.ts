import { z } from "zod";
import { parseUsdToMicros } from "./pricing";

const usd = z
  .string()
  .trim()
  .refine((v) => parseUsdToMicros(v) !== null, "Enter an amount like 3 or 0.075 (max 6 decimals)");

export const addPriceSchema = z.object({
  provider: z.string().trim().min(1, "Enter the provider").max(60),
  model: z.string().trim().min(1, "Enter the model").max(100),
  inputPerMtok: usd,
  outputPerMtok: usd,
  cachedPerMtok: usd,
  /** Optional; ISO date-time or a `datetime-local` value (treated as UTC). Default: now. */
  effectiveFrom: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(v) ? v : `${v}Z`);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({ code: "custom", message: "Enter a valid date and time" });
        return z.NEVER;
      }
      return d;
    }),
  note: z.string().trim().max(200).optional().default(""),
});
export type AddPriceInput = z.infer<typeof addPriceSchema>;

export const USAGE_PERIODS = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type UsagePeriod = keyof typeof USAGE_PERIODS;

export function parsePeriod(value: unknown): UsagePeriod {
  return typeof value === "string" && value in USAGE_PERIODS ? (value as UsagePeriod) : "30d";
}
