import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/db";
import {
  checkSessionCreateRateLimit,
  getClientIp,
  getNoStoreHeaders,
  validateSessionCreateBody,
} from "@/lib/session-guards";

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);
  const rateLimit = checkSessionCreateRateLimit(clientIp);

  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many session creation requests. Try again shortly." },
      {
        status: 429,
        headers: getNoStoreHeaders({ "Retry-After": String(rateLimit.retryAfterSeconds) }),
      }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: getNoStoreHeaders() }
    );
  }

  const validation = validateSessionCreateBody(body);
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error },
      { status: validation.status, headers: getNoStoreHeaders() }
    );
  }

  const { rowCount, csvData, config } = validation.data;

  try {
    const sessionId = await createSession(rowCount, csvData, config);
    return NextResponse.json(
      { sessionId },
      { headers: getNoStoreHeaders() }
    );
  } catch (err) {
    console.error("[sessions POST]", err);
    return NextResponse.json(
      { error: "Failed to save session" },
      { status: 500, headers: getNoStoreHeaders() }
    );
  }
}
