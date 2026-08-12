import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/db";
import {
  enforceSessionFetchRateLimit,
  getClientIp,
  getNoStoreHeaders,
  isValidSessionId,
} from "@/lib/session-guards";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIp = getClientIp(req);
  let rateLimit;
  try {
    rateLimit = await enforceSessionFetchRateLimit(clientIp);
  } catch (err) {
    console.error("[sessions GET rate limit]", err);
    return NextResponse.json(
      { error: "Request protection is temporarily unavailable. Try again shortly." },
      { status: 503, headers: getNoStoreHeaders() }
    );
  }

  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many session lookup requests. Try again shortly." },
      {
        status: 429,
        headers: getNoStoreHeaders({ "Retry-After": String(rateLimit.retryAfterSeconds) }),
      }
    );
  }

  const { id } = await params;

  if (!id || typeof id !== "string" || !isValidSessionId(id)) {
    return NextResponse.json(
      { error: "Invalid session ID" },
      { status: 400, headers: getNoStoreHeaders() }
    );
  }

  try {
    const session = await getSession(id);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found or expired" },
        { status: 404, headers: getNoStoreHeaders() }
      );
    }
    return NextResponse.json(session, { headers: getNoStoreHeaders() });
  } catch (err) {
    console.error("[sessions GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500, headers: getNoStoreHeaders() }
    );
  }
}
