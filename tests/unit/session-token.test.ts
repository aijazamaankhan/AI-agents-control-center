import { describe, expect, it } from "vitest";
import {
  generateSessionToken,
  hashSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session-token";

describe("session tokens", () => {
  it("generates high-entropy unique tokens", () => {
    const t = generateSessionToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateSessionToken()).not.toBe(t);
  });

  it("hashes deterministically without revealing the token", () => {
    const t = generateSessionToken();
    expect(hashSessionToken(t)).toBe(hashSessionToken(t));
    expect(hashSessionToken(t)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken(t)).not.toContain(t);
  });

  it("uses http-only, same-site cookies", () => {
    const opts = sessionCookieOptions(new Date());
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
  });
});
