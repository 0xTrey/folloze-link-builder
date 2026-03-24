import { describe, expect, it, beforeEach } from "vitest";
import {
  __resetRateLimitStoreForTests,
  checkSessionCreateRateLimit,
  checkSessionFetchRateLimit,
  isValidSessionId,
  validateSessionCreateBody,
} from "../lib/session-guards";

const validBody = {
  rowCount: 2,
  csvData: "email,folloze_link\njane@example.com,https://engage.folloze.com/board?em=jane@example.com",
  config: {
    boardUrl: "https://engage.folloze.com/test-board",
    utmSource: "email",
    utmMedium: "email",
    utmCampaign: "spring-launch",
    utmContent: "step1",
  },
};

describe("validateSessionCreateBody", () => {
  it("accepts a valid session payload", () => {
    const result = validateSessionCreateBody(validBody);
    expect(result.ok).toBe(true);
  });

  it("rejects rowCount above MAX_ROWS", () => {
    const result = validateSessionCreateBody({
      ...validBody,
      rowCount: 5001,
    });

    expect(result).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("rejects non-http board URLs", () => {
    const result = validateSessionCreateBody({
      ...validBody,
      config: {
        ...validBody.config,
        boardUrl: "javascript:alert(1)",
      },
    });

    expect(result).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("rejects payloads without the generated folloze_link column", () => {
    const result = validateSessionCreateBody({
      ...validBody,
      csvData: "email\njane@example.com",
    });

    expect(result).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("rejects oversized payloads", () => {
    const result = validateSessionCreateBody({
      ...validBody,
      csvData: `${"x".repeat(5 * 1024 * 1024)}folloze_link`,
    });

    expect(result).toMatchObject({
      ok: false,
      status: 413,
    });
  });
});

describe("session id validation", () => {
  it("accepts valid UUIDs", () => {
    expect(isValidSessionId("92f9b0ef-2ac4-4d2a-8a81-b5f8fc2af252")).toBe(true);
  });

  it("rejects invalid session ids", () => {
    expect(isValidSessionId("../../../etc/passwd")).toBe(false);
    expect(isValidSessionId("not-a-uuid")).toBe(false);
  });
});

describe("rate limiting", () => {
  beforeEach(() => {
    __resetRateLimitStoreForTests();
  });

  it("limits session creation requests after the configured threshold", () => {
    const now = Date.UTC(2026, 2, 24, 12, 0, 0);

    for (let index = 0; index < 20; index += 1) {
      expect(checkSessionCreateRateLimit("203.0.113.5", now).ok).toBe(true);
    }

    const limited = checkSessionCreateRateLimit("203.0.113.5", now);
    expect(limited.ok).toBe(false);
  });

  it("resets the fetch window after expiry", () => {
    const now = Date.UTC(2026, 2, 24, 12, 0, 0);

    for (let index = 0; index < 120; index += 1) {
      expect(checkSessionFetchRateLimit("203.0.113.10", now).ok).toBe(true);
    }

    expect(checkSessionFetchRateLimit("203.0.113.10", now).ok).toBe(false);
    expect(checkSessionFetchRateLimit("203.0.113.10", now + 10 * 60 * 1000 + 1).ok).toBe(true);
  });
});
