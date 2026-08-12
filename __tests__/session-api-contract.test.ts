import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rateLimit = vi.hoisted(() => vi.fn());
const isCloudflareRuntime = vi.hoisted(() => vi.fn());
const createSession = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cloudflare-rate-limit", () => ({
  consumeDistributedRateLimit: rateLimit,
  isCloudflareRuntime,
}));
vi.mock("@/lib/db", () => ({ createSession, getSession }));

import { POST } from "../app/api/sessions/route";
import { GET } from "../app/api/sessions/[id]/route";

const noStore = "no-store, max-age=0";

function postRequest(body: unknown) {
  return new NextRequest("https://preview.example/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "198.51.100.10" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  rateLimit.mockReset();
  isCloudflareRuntime.mockReturnValue(false);
  createSession.mockReset();
  getSession.mockReset();
});

describe("session API privacy and error contract", () => {
  it("returns 400 and no-store for malformed create input", async () => {
    const response = await POST(postRequest({}));
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe(noStore);
  });

  it("returns 413 and no-store for a synthetic 5 MiB-plus CSV without persisting it", async () => {
    const response = await POST(postRequest({
      rowCount: 1,
      csvData: `${"x".repeat(5 * 1024 * 1024)}folloze_link`,
      config: { boardUrl: "https://engage.folloze.com/board", utmSource: "a", utmMedium: "b", utmCampaign: "c", utmContent: "d" }
    }));
    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toBe(noStore);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("returns 429 and no-store when the distributed limiter rejects", async () => {
    isCloudflareRuntime.mockReturnValue(true);
    rateLimit.mockResolvedValue({ ok: false, remaining: 0, resetAt: Date.now() + 60_000, retryAfterSeconds: 60 });
    const response = await POST(postRequest({}));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("cache-control")).toBe(noStore);
  });

  it("keeps Vercel's in-memory limiter when the Cloudflare binding is absent", async () => {
    const { enforceSessionCreateRateLimit } = await import("@/lib/session-guards");
    await expect(enforceSessionCreateRateLimit("203.0.113.5")).resolves.toMatchObject({ ok: true });
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("fails closed only when Cloudflare is explicit and its binding is absent", async () => {
    isCloudflareRuntime.mockReturnValue(true);
    rateLimit.mockRejectedValue(new Error("RATE_LIMITER Durable Object binding is unavailable."));
    const response = await POST(postRequest({}));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe(noStore);
  });

  it("returns 404 and no-store for a valid but expired session ID", async () => {
    getSession.mockResolvedValue(null);
    const request = new NextRequest("https://preview.example/api/sessions/92f9b0ef-2ac4-4d2a-8a81-b5f8fc2af252", {
      headers: { "cf-connecting-ip": "198.51.100.10" },
    });
    const response = await GET(request, { params: Promise.resolve({ id: "92f9b0ef-2ac4-4d2a-8a81-b5f8fc2af252" }) });
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe(noStore);
  });
});
