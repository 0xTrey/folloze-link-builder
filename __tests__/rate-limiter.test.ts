import { describe, expect, it } from "vitest";

import { consumeRateLimitWindow } from "../worker/rate-limiter";
import { RateLimiter } from "../worker/rate-limiter";

describe("Durable Object fixed-window counter", () => {
  it("serially accepts up to the limit and rejects the next request", () => {
    let current: { count: number; resetAt: number } | undefined;
    for (let index = 0; index < 3; index += 1) {
      const result = consumeRateLimitWindow(current, { limit: 3, windowMs: 60_000, now: 1_000 });
      current = result.next;
      expect(result.decision.ok).toBe(true);
    }
    const limited = consumeRateLimitWindow(current, { limit: 3, windowMs: 60_000, now: 1_000 });
    expect(limited.decision).toMatchObject({ ok: false, remaining: 0, retryAfterSeconds: 60 });
  });

  it("resets after its fixed window expires", () => {
    const current = { count: 7, resetAt: 10_000 };
    const result = consumeRateLimitWindow(current, { limit: 2, windowMs: 60_000, now: 10_001 });
    expect(result.next).toEqual({ count: 1, resetAt: 70_001 });
    expect(result.decision).toMatchObject({ ok: true, remaining: 1 });
  });

  it("rejects arbitrary limit and window parameters", async () => {
    const limiter = new RateLimiter({ storage: { get: async () => undefined, put: async () => undefined } });
    const response = await limiter.fetch(new Request("https://rate-limiter/consume", {
      method: "POST",
      body: JSON.stringify({ limit: 999_999, windowMs: 86_400_000 }),
    }));
    expect(response.status).toBe(400);
  });
});
