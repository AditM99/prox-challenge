import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session-store";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("id");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing session ID" }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // If we have a stored original file, serve it
  if (session.originalFile) {
    const buffer = Buffer.from(session.originalFile.base64, "base64");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": session.originalFile.mimeType,
        "Content-Disposition": `inline; filename="${session.originalFile.name}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  // If we have a source URL, redirect to it
  if (session.sourceUrl) {
    return NextResponse.json({ redirect: session.sourceUrl });
  }

  return NextResponse.json({ error: "No document available" }, { status: 404 });
}
