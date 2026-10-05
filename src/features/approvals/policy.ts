import type { CapabilityRule } from "@/generated/prisma/enums";
import { capabilityKey } from "@/features/agents/schemas";

/** Same key derivation as agent capabilities: "Send external email" → "send_external_email". */
export const capabilityKeyOf = capabilityKey;

export interface CapabilityLike {
  key: string;
  label: string;
  rule: CapabilityRule;
}

/**
 * The agent capability an approval request refers to: the explicit `capability` key if sent,
 * otherwise the action text matched against capability keys and labels. null = no match.
 */
export function matchCapability(
  action: string,
  capability: string | undefined,
  capabilities: CapabilityLike[],
): CapabilityLike | null {
  const wanted = capabilityKeyOf(capability ?? action);
  return capabilities.find((c) => c.key === wanted || capabilityKeyOf(c.label) === wanted) ?? null;
}

export type PolicyOutcome = "APPROVED" | "REJECTED" | "PENDING";

/** ALLOWED → approved automatically, DENIED → rejected automatically, anything else → a person decides. */
export function policyOutcome(match: CapabilityLike | null): PolicyOutcome {
  if (match?.rule === "ALLOWED") return "APPROVED";
  if (match?.rule === "DENIED") return "REJECTED";
  return "PENDING";
}
