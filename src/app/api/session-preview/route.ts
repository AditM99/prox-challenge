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

  // Build a preview of the extracted content
  const sections = new Map<string, { pages: Set<number>; chunkCount: number; previewText: string }>();

  for (const chunk of session.chunks) {
    const key = chunk.section;
    if (!sections.has(key)) {
      sections.set(key, { pages: new Set(), chunkCount: 0, previewText: "" });
    }
    const sec = sections.get(key)!;
    sec.pages.add(chunk.pageNumber);
    sec.chunkCount++;
    if (!sec.previewText) {
      sec.previewText = chunk.content.slice(0, 200);
    }
  }

  const sectionList = Array.from(sections.entries()).map(([name, data]) => ({
    name,
    pages: Array.from(data.pages).sort((a, b) => a - b),
    chunkCount: data.chunkCount,
    preview: data.previewText,
  }));

  // Collect top keywords across all chunks
  const keywordFreq: Record<string, number> = {};
  for (const chunk of session.chunks) {
    for (const kw of chunk.keywords) {
      keywordFreq[kw] = (keywordFreq[kw] || 0) + 1;
    }
  }
  const topKeywords = Object.entries(keywordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([kw]) => kw);

  // Determine document type for viewer
  let documentType: "pdf" | "web" | "none" = "none";
  if (session.originalFile?.mimeType === "application/pdf") {
    documentType = "pdf";
  } else if (session.sourceUrl) {
    documentType = session.sourceUrl.toLowerCase().endsWith(".pdf") ? "pdf" : "web";
  }

  return NextResponse.json({
    productName: session.productName,
    totalChunks: session.chunks.length,
    totalImages: session.uploadedImages?.length || 0,
    source: session.files[0]?.name || "Unknown",
    sections: sectionList,
    topKeywords,
    documentType,
    sourceUrl: session.sourceUrl || null,
    hasOriginalFile: !!session.originalFile,
  });
}
