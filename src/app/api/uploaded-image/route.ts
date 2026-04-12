import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session-store";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session");
  const imageId = searchParams.get("id");

  if (!sessionId || !imageId) {
    return NextResponse.json({ error: "Missing session or id" }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const image = session.uploadedImages.find((img) => img.id === imageId);
  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const buffer = Buffer.from(image.base64, "base64");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
