import type { CapabilityRule } from "@/generated/prisma/enums";

/** Shared by server and client components — keep this module free of "use client". */
export const RULE_STYLE: Record<CapabilityRule, { color: string; symbol: string }> = {
  ALLOWED: { color: "var(--color-primary)", symbol: "✓" },
  APPROVAL_REQUIRED: { color: "var(--color-warning)", symbol: "!" },
  DENIED: { color: "var(--color-error)", symbol: "✕" },
};
