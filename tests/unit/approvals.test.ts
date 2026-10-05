import { describe, expect, it } from "vitest";
import { capabilityKeyOf, matchCapability, policyOutcome } from "@/features/approvals/policy";
import { decisionSchema, decideFormSchema } from "@/features/approvals/schemas";
import { summarize } from "@/features/events/transitions";

const CAPS = [
  { key: "send_external_email", label: "Send external email", rule: "APPROVAL_REQUIRED" as const },
  { key: "read_crm", label: "Read CRM", rule: "ALLOWED" as const },
  { key: "make_payments", label: "Make payments", rule: "DENIED" as const },
];

describe("approval policy", () => {
  it("derives capability keys like agent capabilities do", () => {
    expect(capabilityKeyOf("Send external email")).toBe("send_external_email");
    expect(capabilityKeyOf("send-external-email")).toBe("send_external_email");
  });

  it("matches the explicit capability first, then the action text", () => {
    expect(matchCapability("Pay invoice 42", "make_payments", CAPS)?.key).toBe("make_payments");
    expect(matchCapability("Read CRM", undefined, CAPS)?.key).toBe("read_crm");
    expect(matchCapability("Send 12 external emails", undefined, CAPS)).toBeNull();
  });

  it("auto-decides only Allowed and Denied rules", () => {
    expect(policyOutcome(CAPS[1]!)).toBe("APPROVED");
    expect(policyOutcome(CAPS[2]!)).toBe("REJECTED");
    expect(policyOutcome(CAPS[0]!)).toBe("PENDING");
    expect(policyOutcome(null)).toBe("PENDING");
  });

  it("validates decisions", () => {
    expect(decisionSchema.parse({}).note).toBe("");
    expect(decisionSchema.safeParse({ note: "x".repeat(501) }).success).toBe(false);
    expect(decideFormSchema.safeParse({ id: "apr_1", decision: "MAYBE" }).success).toBe(false);
  });

  it("summarises decision events from their message", () => {
    expect(summarize({ type: "APPROVAL_DECIDED", message: "Approved by Asha: Send email" })).toBe(
      "Approved by Asha: Send email",
    );
  });
});
