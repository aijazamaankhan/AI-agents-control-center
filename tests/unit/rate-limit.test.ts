import { describe, expect, it } from "vitest";
import { MemoryRateLimiter } from "@/lib/security/rate-limit";

describe("MemoryRateLimiter", () => {
  it("blocks after the limit and recovers after the window", async () => {
    let now = 0;
    const limiter = new MemoryRateLimiter(() => now);
    for (let i = 0; i < 3; i++) expect((await limiter.hit("k", 3, 1000)).ok).toBe(true);
    const blocked = await limiter.hit("k", 3, 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBe(1000);
    now = 1000;
    expect((await limiter.hit("k", 3, 1000)).ok).toBe(true);
  });

  it("isolates keys and supports reset", async () => {
    const limiter = new MemoryRateLimiter(() => 0);
    await limiter.hit("a", 1, 1000);
    expect((await limiter.hit("a", 1, 1000)).ok).toBe(false);
    expect((await limiter.hit("b", 1, 1000)).ok).toBe(true);
    await limiter.reset("a");
    expect((await limiter.hit("a", 1, 1000)).ok).toBe(true);
  });
});
