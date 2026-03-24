import type { NextRequest } from "next/server";
import { MAX_ROWS } from "@/lib/csv-parser";
import type { SessionConfig } from "@/lib/db";

const POST_WINDOW_MS = 10 * 60 * 1000;
const GET_WINDOW_MS = 10 * 60 * 1000;
const POST_LIMIT = 20;
const GET_LIMIT = 120;
const MAX_BOARD_URL_LENGTH = 2048;
const MAX_TRACKING_VALUE_LENGTH = 160;
const MAX_SESSION_CSV_BYTES = 5 * 1024 * 1024;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SessionCreateBody = {
  rowCount: number;
  csvData: string;
  config: SessionConfig;
};

type ValidationResult =
  | { ok: true; data: SessionCreateBody }
  | { ok: false; error: string; status: number };

type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; retryAfterSeconds: number; resetAt: number };

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateLimitEntry>;

declare global {
  // eslint-disable-next-line no-var
  var __follozeRateLimitStore: RateLimitStore | undefined;
}

const rateLimitStore = globalThis.__follozeRateLimitStore ?? new Map<string, RateLimitEntry>();
globalThis.__follozeRateLimitStore = rateLimitStore;

export function getNoStoreHeaders(extra?: Record<string, string>) {
  return {
    "Cache-Control": "no-store, max-age=0",
    ...extra,
  };
}

export function getClientIp(request: Pick<NextRequest, "headers">): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

export function checkSessionCreateRateLimit(clientIp: string, now = Date.now()) {
  return checkRateLimit(`session-post:${clientIp}`, POST_LIMIT, POST_WINDOW_MS, now);
}

export function checkSessionFetchRateLimit(clientIp: string, now = Date.now()) {
  return checkRateLimit(`session-get:${clientIp}`, GET_LIMIT, GET_WINDOW_MS, now);
}

export function isValidSessionId(id: string) {
  return UUID_REGEX.test(id);
}

export function validateSessionCreateBody(body: unknown): ValidationResult {
  if (!isRecord(body)) {
    return { ok: false, status: 400, error: "Invalid request body" };
  }

  const rowCount = typeof body.rowCount === "number" ? body.rowCount : NaN;
  if (!Number.isInteger(rowCount) || rowCount <= 0 || rowCount > MAX_ROWS) {
    return {
      ok: false,
      status: 400,
      error: `rowCount must be an integer between 1 and ${MAX_ROWS.toLocaleString()}.`,
    };
  }

  const csvData = typeof body.csvData === "string" ? body.csvData : null;
  if (!csvData) {
    return { ok: false, status: 400, error: "csvData is required." };
  }

  const csvBytes = new TextEncoder().encode(csvData).length;
  if (csvBytes > MAX_SESSION_CSV_BYTES) {
    return {
      ok: false,
      status: 413,
      error: "CSV output exceeds the maximum allowed payload size.",
    };
  }

  if (!csvData.includes("folloze_link")) {
    return {
      ok: false,
      status: 400,
      error: "csvData must contain the generated folloze_link column.",
    };
  }

  if (!isRecord(body.config)) {
    return { ok: false, status: 400, error: "config is required." };
  }

  const boardUrl = typeof body.config.boardUrl === "string" ? body.config.boardUrl.trim() : "";
  if (!boardUrl) {
    return { ok: false, status: 400, error: "config.boardUrl is required." };
  }

  if (boardUrl.length > MAX_BOARD_URL_LENGTH) {
    return { ok: false, status: 400, error: "config.boardUrl is too long." };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(boardUrl);
  } catch {
    return { ok: false, status: 400, error: "config.boardUrl must be a valid URL." };
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return { ok: false, status: 400, error: "config.boardUrl must use http or https." };
  }

  const rawTrackingFields = {
    utmSource: typeof body.config.utmSource === "string" ? body.config.utmSource : null,
    utmMedium: typeof body.config.utmMedium === "string" ? body.config.utmMedium : null,
    utmCampaign: typeof body.config.utmCampaign === "string" ? body.config.utmCampaign : null,
    utmContent: typeof body.config.utmContent === "string" ? body.config.utmContent : null,
  };

  for (const [field, value] of Object.entries(rawTrackingFields)) {
    if (value === null) {
      return { ok: false, status: 400, error: `${field} must be a string.` };
    }

    if (value.length > MAX_TRACKING_VALUE_LENGTH) {
      return { ok: false, status: 400, error: `${field} is too long.` };
    }
  }

  const utmSource = rawTrackingFields.utmSource as string;
  const utmMedium = rawTrackingFields.utmMedium as string;
  const utmCampaign = rawTrackingFields.utmCampaign as string;
  const utmContent = rawTrackingFields.utmContent as string;

  return {
    ok: true,
    data: {
      rowCount,
      csvData,
      config: {
        boardUrl,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
      },
    },
  };
}

export function __resetRateLimitStoreForTests() {
  rateLimitStore.clear();
}

function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number
): RateLimitResult {
  pruneExpiredEntries(now);

  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }

  if (current.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      resetAt: current.resetAt,
    };
  }

  current.count += 1;
  rateLimitStore.set(key, current);

  return {
    ok: true,
    remaining: limit - current.count,
    resetAt: current.resetAt,
  };
}

function pruneExpiredEntries(now: number) {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
