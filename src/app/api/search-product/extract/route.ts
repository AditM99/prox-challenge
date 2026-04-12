import { NextResponse } from "next/server";
import { fetchAndExtract } from "@/lib/web-scraper";
import { createSession, generateSessionId } from "@/lib/session-store";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { url, productName } = await request.json();

    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return NextResponse.json(
        { error: "A valid URL is required" },
        { status: 400 }
      );
    }

    if (!productName || typeof productName !== "string") {
      return NextResponse.json(
        { error: "Product name is required" },
        { status: 400 }
      );
    }

    const trimmed = productName.trim();
    const chunks = await fetchAndExtract(url, trimmed);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "Could not extract content from this page. Try a different result." },
        { status: 422 }
      );
    }

    const sessionId = generateSessionId();
    createSession({
      sessionId,
      productName: trimmed,
      files: [{ name: url, type: "web", size: 0 }],
      chunks,
      uploadedImages: [],
      sourceUrl: url,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      sessionId,
      productName: trimmed,
      source: url,
      chunksCreated: chunks.length,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to extract manual content";
    console.error("[extract] Error:", message);
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
