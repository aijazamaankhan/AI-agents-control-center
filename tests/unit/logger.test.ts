import { describe, expect, it } from "vitest";
import { redact } from "@/lib/logger";

describe("redact", () => {
  it("removes secret-looking values at any depth", () => {
    const out = redact({
      email: "a@b.c",
      password: "hunter2",
      nested: { apiKey: "sk-123", authorization: "Bearer x", ok: 1 },
    });
    expect(out).toEqual({
      email: "a@b.c",
      password: "[REDACTED]",
      nested: { apiKey: "[REDACTED]", authorization: "[REDACTED]", ok: 1 },
    });
  });
});
