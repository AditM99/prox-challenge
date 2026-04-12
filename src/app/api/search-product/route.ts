import { NextResponse } from "next/server";
import { findAndExtractManual } from "@/lib/web-scraper";
import { createSession, generateSessionId } from "@/lib/session-store";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { productName } = await request.json();

    if (!productName || typeof productName !== "string") {
      return NextResponse.json(
        { error: "Product name is required" },
        { status: 400 }
      );
    }

    const trimmed = productName.trim();
    if (trimmed.length < 2 || trimmed.length > 200) {
      return NextResponse.json(
        { error: "Product name must be between 2 and 200 characters" },
        { status: 400 }
      );
    }

    const { source, chunks } = await findAndExtractManual(trimmed);

    const sessionId = generateSessionId();
    createSession({
      sessionId,
      productName: trimmed,
      files: [{ name: source, type: "web", size: 0 }],
      chunks,
      uploadedImages: [],
      createdAt: Date.now(),
    });

    return NextResponse.json({
      sessionId,
      productName: trimmed,
      source,
      chunksCreated: chunks.length,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to search for manual";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
