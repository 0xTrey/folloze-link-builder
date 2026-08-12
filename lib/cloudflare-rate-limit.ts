import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { RateLimitDecision } from "@/worker/rate-limiter";

type DurableObjectStub = { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
type DurableObjectNamespace = {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStub;
};

type CloudflareEnv = { RATE_LIMITER?: DurableObjectNamespace };

export type DistributedRateLimitResult = RateLimitDecision;

/**
 * This is an explicit Worker-only binding, not environment inference. Keeping
 * Vercel on its existing limiter is required until its production alias retires.
 */
export function isCloudflareRuntime(): boolean {
  return process.env.FOLLOZE_LINK_BUILDER_PLATFORM === "cloudflare";
}

async function digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function rateLimiterBinding(): DurableObjectNamespace | undefined {
  try {
    return (getCloudflareContext().env as CloudflareEnv).RATE_LIMITER;
  } catch {
    return undefined;
  }
}

export async function consumeDistributedRateLimit(input: {
  scope: string;
  clientIp: string;
  limit: number;
  windowMs: number;
}): Promise<DistributedRateLimitResult> {
  const binding = rateLimiterBinding();
  if (!binding) {
    throw new Error("RATE_LIMITER Durable Object binding is unavailable.");
  }
  const key = await digest(`${input.scope}\u0000${input.clientIp}`);
  const response = await binding.get(binding.idFromName(key)).fetch("https://rate-limiter/consume", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ limit: input.limit, windowMs: input.windowMs })
  });
  const result = await response.json() as DistributedRateLimitResult;
  if (!response.ok && response.status !== 429) {
    throw new Error("Distributed rate limiter returned an invalid response.");
  }
  return result;
}
