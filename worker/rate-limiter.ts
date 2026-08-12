type DurableObjectStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
};

type DurableObjectState = { storage: DurableObjectStorage };

type LimitRequest = {
  limit: number;
  windowMs: number;
  now?: number;
};

type LimitState = {
  count: number;
  resetAt: number;
};

export type RateLimitDecision = {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds?: number;
};

const stateKey = "window";
const allowedLimits = new Set([20, 120]);
const allowedWindows = new Set([10 * 60_000]);

export function consumeRateLimitWindow(
  current: LimitState | undefined,
  request: LimitRequest
): { next: LimitState; decision: RateLimitDecision } {
  const now = request.now ?? Date.now();
  const initial = !current || current.resetAt <= now;
  const next: LimitState = initial
    ? { count: 1, resetAt: now + request.windowMs }
    : { ...current, count: current.count + 1 };
  const ok = next.count <= request.limit;
  return {
    next,
    decision: {
      ok,
      remaining: Math.max(0, request.limit - next.count),
      resetAt: next.resetAt,
      ...(ok ? {} : { retryAfterSeconds: Math.max(1, Math.ceil((next.resetAt - now) / 1000)) })
    }
  };
}

/**
 * One Durable Object instance is addressed per hashed client-and-route key.
 * Durable Object request serialization makes each fixed-window increment
 * deterministic across Worker isolates without retaining customer CSV data.
 */
export class RateLimiter {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
    const input = (await request.json()) as Partial<LimitRequest>;
    const limit = input.limit;
    const windowMs = input.windowMs;
    if (typeof limit !== "number" || typeof windowMs !== "number" ||
      !Number.isInteger(limit) || !Number.isInteger(windowMs) ||
      !allowedLimits.has(limit) || !allowedWindows.has(windowMs)) {
      return new Response("Invalid rate limit request", { status: 400 });
    }
    const current = await this.state.storage.get<LimitState>(stateKey);
    const { next, decision } = consumeRateLimitWindow(current, {
      limit,
      windowMs,
      now: input.now
    });
    await this.state.storage.put(stateKey, next);
    return Response.json(decision, { status: decision.ok ? 200 : 429 });
  }
}
