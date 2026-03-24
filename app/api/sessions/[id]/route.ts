import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
  }

  try {
    const session = await getSession(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
    }
    return NextResponse.json(session);
  } catch (err) {
    console.error("[sessions GET]", err);
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}
