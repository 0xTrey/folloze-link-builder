import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/db";
import type { SessionConfig } from "@/lib/db";

export async function POST(req: NextRequest) {
  let body: { rowCount: number; csvData: string; config: SessionConfig };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { rowCount, csvData, config } = body;

  if (!rowCount || !csvData || !config?.boardUrl) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const sessionId = await createSession(rowCount, csvData, config);
    return NextResponse.json({ sessionId });
  } catch (err) {
    console.error("[sessions POST]", err);
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
  }
}
