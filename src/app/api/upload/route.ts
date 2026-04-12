import { NextRequest, NextResponse } from "next/server";
import { createSession, generateSessionId } from "@/lib/session-store";
import type { TextChunk } from "@/lib/types";

// pdf-parse is CJS
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

export const maxDuration = 60;

const SUPPORTED_TEXT = [
  "text/plain",
  "text/markdown",
  "text/html",
  "text/csv",
];
const SUPPORTED_IMAGES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const SUPPORTED_DOCS = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const productName = (formData.get("productName") as string) || "Uploaded Product";
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json(
        { error: "No files uploaded" },
        { status: 400 }
      );
    }

    // Validate file sizes (max 20MB each)
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds 20MB limit` },
          { status: 400 }
        );
      }
    }

    const chunks: TextChunk[] = [];
    const uploadedImages: { id: string; name: string; base64: string; mimeType: string }[] = [];
    let chunkIndex = 0;
    let originalFile: { base64: string; mimeType: string; name: string } | undefined;

    for (const file of files) {
      const type = file.type || inferMimeType(file.name);

      if (type === "application/pdf") {
        const buffer = Buffer.from(await file.arrayBuffer());
        const newChunks = await extractPdfChunks(buffer, file.name, chunkIndex);
        chunks.push(...newChunks);
        chunkIndex += newChunks.length;
        if (!originalFile) {
          originalFile = { base64: buffer.toString("base64"), mimeType: type, name: file.name };
        }
      } else if (
        type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const newChunks = await extractDocxChunks(buffer, file.name, chunkIndex);
        chunks.push(...newChunks);
        chunkIndex += newChunks.length;
      } else if (SUPPORTED_TEXT.includes(type)) {
        const text = await file.text();
        const newChunks = extractTextChunks(text, file.name, type, chunkIndex);
        chunks.push(...newChunks);
        chunkIndex += newChunks.length;
      } else if (SUPPORTED_IMAGES.includes(type)) {
        // Store images for Claude vision
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = buffer.toString("base64");
        uploadedImages.push({
          id: `img-${uploadedImages.length}`,
          name: file.name,
          base64,
          mimeType: type,
        });
      } else {
        // Try to read as text anyway
        try {
          const text = await file.text();
          if (text && text.length > 10) {
            const newChunks = extractTextChunks(text, file.name, "text/plain", chunkIndex);
            chunks.push(...newChunks);
            chunkIndex += newChunks.length;
          }
        } catch {
          // Skip unsupported files
        }
      }
    }

    if (chunks.length === 0 && uploadedImages.length === 0) {
      return NextResponse.json(
        { error: "Could not extract any content from the uploaded files. Supported formats: PDF, DOCX, TXT, MD, HTML, CSV, JPG, PNG, WEBP" },
        { status: 400 }
      );
    }

    const sessionId = generateSessionId();
    createSession({
      sessionId,
      productName,
      files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
      chunks,
      uploadedImages,
      originalFile,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      sessionId,
      productName,
      filesProcessed: files.length,
      chunksCreated: chunks.length,
      imagesStored: uploadedImages.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function inferMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    html: "text/html",
    htm: "text/html",
    csv: "text/csv",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return map[ext || ""] || "application/octet-stream";
}

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const stopWords = new Set([
    "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
    "her", "was", "one", "our", "out", "has", "have", "from", "been", "will",
    "with", "this", "that", "they", "than", "when", "what", "which", "where",
    "there", "their", "them", "then", "these", "those", "into", "over",
    "after", "before", "should", "could", "would", "about", "each", "make",
    "like", "does", "only", "also", "must", "may", "use", "used", "using",
  ]);
  const freq: Record<string, number> = {};
  for (const word of words) {
    if (!stopWords.has(word)) freq[word] = (freq[word] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w]) => w);
}

async function extractPdfChunks(
  buffer: Buffer,
  filename: string,
  startIndex: number
): Promise<TextChunk[]> {
  const data = await pdfParse(buffer);
  const rawText: string = data.text;
  if (!rawText.trim()) return [];

  return chunkText(rawText, filename, startIndex);
}

async function extractDocxChunks(
  buffer: Buffer,
  filename: string,
  startIndex: number
): Promise<TextChunk[]> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;
  if (!text.trim()) return [];

  return chunkText(text, filename, startIndex);
}

function extractTextChunks(
  text: string,
  filename: string,
  mimeType: string,
  startIndex: number
): TextChunk[] {
  let cleanText = text;

  // Strip HTML tags if HTML
  if (mimeType === "text/html") {
    cleanText = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  if (!cleanText.trim()) return [];
  return chunkText(cleanText, filename, startIndex);
}

function chunkText(
  text: string,
  source: string,
  startIndex: number
): TextChunk[] {
  const chunks: TextChunk[] = [];
  const paragraphs = text.split(/\n{2,}/);

  let currentChunk = "";
  let chunkIdx = startIndex;
  let pageEstimate = 1;
  const charsPerPage = Math.max(2000, Math.ceil(text.length / 50));

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    currentChunk += trimmed + "\n\n";

    if (currentChunk.length > 1500) {
      chunks.push({
        id: `upload-${String(++chunkIdx).padStart(3, "0")}`,
        pageNumber: pageEstimate,
        section: source,
        content: currentChunk.trim(),
        keywords: extractKeywords(currentChunk),
      });
      pageEstimate = Math.ceil(
        (text.indexOf(trimmed) + trimmed.length) / charsPerPage
      );
      currentChunk = "";
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      id: `upload-${String(++chunkIdx).padStart(3, "0")}`,
      pageNumber: pageEstimate,
      section: source,
      content: currentChunk.trim(),
      keywords: extractKeywords(currentChunk),
    });
  }

  return chunks;
}
