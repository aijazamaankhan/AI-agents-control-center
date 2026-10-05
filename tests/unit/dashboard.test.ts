import { describe, expect, it } from "vitest";
import { greetingFor } from "@/features/dashboard/server/dashboard-service";

describe("greetingFor", () => {
  it("uses the organization's timezone", () => {
    const at = new Date("2026-10-05T04:00:00Z");
    expect(greetingFor(at, "UTC")).toBe("Good morning");
    expect(greetingFor(at, "Asia/Kolkata")).toBe("Good morning"); // 09:30
    expect(greetingFor(at, "America/Los_Angeles")).toBe("Good evening"); // 21:00 previous day
    expect(greetingFor(new Date("2026-10-05T14:00:00Z"), "UTC")).toBe("Good afternoon");
  });

  it("falls back to UTC on an invalid timezone", () => {
    expect(greetingFor(new Date("2026-10-05T20:00:00Z"), "Not/AZone")).toBe("Good evening");
  });
});
