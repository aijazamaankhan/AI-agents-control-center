import { describe, expect, it } from "vitest";
import {
  computeCost,
  formatUsd,
  microsToUsd,
  parseUsdToMicros,
  priceKeyOf,
} from "@/features/usage/pricing";
import { addPriceSchema, parsePeriod } from "@/features/usage/schemas";
import { can } from "@/lib/security/permissions";
import { addDays, localDay } from "@/lib/time";

describe("pricing math", () => {
  it("normalises provider/model into one matching key", () => {
    expect(priceKeyOf("Anthropic", "Claude Sonnet")).toBe("anthropic/claude-sonnet");
    expect(priceKeyOf(" anthropic ", "claude_sonnet")).toBe("anthropic/claude-sonnet");
    expect(priceKeyOf(null, "")).toBe("unknown/unknown");
  });

  it("parses USD amounts into exact micro-dollars", () => {
    expect(parseUsdToMicros("3")).toBe(3_000_000n);
    expect(parseUsdToMicros("0.075")).toBe(75_000n);
    expect(parseUsdToMicros("1.000001")).toBe(1_000_001n);
    for (const bad of ["", "-1", "1.0000001", "1e3", "$3", "abc"]) {
      expect(parseUsdToMicros(bad)).toBeNull();
    }
    expect(microsToUsd(3_750_000n)).toBe("3.75");
    expect(microsToUsd(75_000n)).toBe("0.075");
  });

  it("computes cost exactly to 12 decimals (input + output + cached)", () => {
    const price = { input: 3_000_000n, output: 15_000_000n, cached: 300_000n };
    expect(
      computeCost({ inputTokens: 10_000, outputTokens: 2_000, cachedTokens: 1_000 }, price),
    ).toBe("0.060300000000");
    expect(computeCost({ inputTokens: 1, outputTokens: 0, cachedTokens: 0 }, price)).toBe(
      "0.000003000000",
    );
    expect(computeCost({ inputTokens: 0, outputTokens: 0, cachedTokens: 0 }, price)).toBe(
      "0.000000000000",
    );
  });

  it("formats USD for display without hiding tiny amounts", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(0.00004)).toBe("<$0.0001");
    expect(formatUsd(0.0042)).toBe("$0.0042");
    expect(formatUsd(1234.5)).toBe("$1,234.50");
  });
});

describe("usage schemas & permissions", () => {
  it("validates price input", () => {
    const ok = addPriceSchema.parse({
      provider: "OpenAI",
      model: "GPT-5",
      inputPerMtok: "1.25",
      outputPerMtok: "10",
      cachedPerMtok: "0.125",
      effectiveFrom: "2026-10-01T00:00",
    });
    expect(ok.effectiveFrom?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(
      addPriceSchema.safeParse({
        provider: "",
        model: "x",
        inputPerMtok: "-1",
        outputPerMtok: "1",
        cachedPerMtok: "0",
      }).success,
    ).toBe(false);
  });

  it("defaults unknown periods to 30 days", () => {
    expect(parsePeriod("7d")).toBe("7d");
    expect(parsePeriod("1y")).toBe("30d");
    expect(parsePeriod(undefined)).toBe("30d");
  });

  it("shows costs to owners, admins and managers only", () => {
    expect(can("OWNER", "costs:read")).toBe(true);
    expect(can("MANAGER", "costs:read")).toBe(true);
    expect(can("MEMBER", "costs:read")).toBe(false);
    expect(can("VIEWER", "costs:read")).toBe(false);
  });

  it("buckets instants into the organization's calendar day", () => {
    const at = new Date("2026-10-05T20:30:00Z"); // 02:00 on Oct 6 in Kolkata
    expect(localDay(at, "Asia/Kolkata").toISOString()).toBe("2026-10-06T00:00:00.000Z");
    expect(localDay(at, "America/New_York").toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(addDays(localDay(at, "UTC"), -6).toISOString()).toBe("2026-09-29T00:00:00.000Z");
  });
});
