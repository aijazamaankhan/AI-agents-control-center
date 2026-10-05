import { describe, expect, it } from "vitest";
import { hasPrefix, newId, ulid } from "@/lib/ids";

describe("ids", () => {
  it("creates prefixed 26-char ULID bodies", () => {
    const id = newId("agent");
    expect(id).toMatch(/^agt_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(hasPrefix(id, "agent")).toBe(true);
    expect(hasPrefix(id, "organization")).toBe(false);
  });

  it("is lexicographically sortable by time", () => {
    const a = ulid(1_700_000_000_000);
    const b = ulid(1_700_000_000_001);
    expect(a < b).toBe(true);
  });

  it("does not collide in practice", () => {
    const ids = new Set(Array.from({ length: 5000 }, () => newId("task")));
    expect(ids.size).toBe(5000);
  });
});
