import { z } from "zod";

export const TASK_STATUSES = [
  "QUEUED",
  "RUNNING",
  "WAITING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export const DATE_RANGES = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
} as const;

const opt = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim().slice(0, max) || undefined);

/** /tasks query string. Unknown or malformed values are dropped, never errors. */
export const taskFiltersSchema = z.object({
  q: opt(100),
  department: opt(64),
  agent: opt(64),
  status: z
    .string()
    .optional()
    .transform((v) =>
      (TASK_STATUSES as readonly string[]).includes(v ?? "")
        ? (v as (typeof TASK_STATUSES)[number])
        : undefined,
    ),
  provider: opt(60),
  model: opt(100),
  range: z
    .string()
    .optional()
    .transform((v) => (v && v in DATE_RANGES ? (v as keyof typeof DATE_RANGES) : "7d")),
  page: z
    .string()
    .optional()
    .transform((v) => Math.min(Math.max(1, Number.parseInt(v ?? "1", 10) || 1), 1000)),
});

export type TaskFilters = z.infer<typeof taskFiltersSchema>;

export function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
