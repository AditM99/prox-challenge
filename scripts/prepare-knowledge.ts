import fs from "fs";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

const FILES_DIR = path.join(process.cwd(), "files");
const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");

// Page-to-section mapping based on the manual's table of contents
const PAGE_SECTIONS: Record<number, string> = {
  1: "Cover",
  2: "Safety",
  3: "Safety",
  4: "Safety",
  5: "Safety",
  6: "Safety",
  7: "Specifications",
  8: "Controls",
  9: "Controls - Interior",
  10: "MIG/Flux-Cored Setup",
  11: "MIG/Flux-Cored Setup - Wire Spool",
  12: "MIG/Flux-Cored Setup - Wire Feed",
  13: "MIG/Flux-Cored Setup - Wire Feed",
  14: "MIG/Flux-Cored Setup - Polarity",
  15: "MIG/Flux-Cored Setup - Polarity",
  16: "MIG/Flux-Cored Setup - Polarity",
  17: "MIG Setup - Gas",
  18: "MIG Setup - Gas",
  19: "MIG/Flux-Cored Setup - Ground Clamp",
  20: "MIG/Flux-Cored Welding Operation",
  21: "MIG/Flux-Cored Welding Operation",
  22: "MIG/Flux-Cored Welding Operation",
  23: "MIG/Flux-Cored Welding Operation",
  24: "TIG/Stick Welding Setup",
  25: "TIG Welding Setup",
  26: "TIG Welding Setup",
  27: "TIG Welding Setup",
  28: "TIG Welding Setup",
  29: "TIG Welding Operation",
  30: "TIG Welding Operation",
  31: "TIG Welding Operation",
  32: "Stick Welding Setup",
  33: "Stick Welding Operation",
  34: "Welding Tips",
  35: "Welding Tips - Weld Diagnosis",
  36: "Welding Tips",
  37: "Welding Tips",
  38: "Welding Tips",
  39: "Welding Tips",
  40: "Welding Tips",
  41: "Maintenance",
  42: "Maintenance",
  43: "Troubleshooting",
  44: "Troubleshooting",
  45: "Wiring Schematic",
  46: "Parts List",
  47: "Assembly Diagram",
  48: "Warranty",
};

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const stopWords = new Set([
    "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
    "her", "was", "one", "our", "out", "has", "have", "from", "been", "will",
    "with", "this", "that", "they", "than", "when", "what", "which", "where",
    "there", "their", "them", "then", "these", "those", "into", "over",
    "after", "before", "should", "could", "would", "about", "each", "make",
    "like", "does", "only", "also", "must", "may", "use", "used", "using",
    "page", "manual", "owner", "figure", "see", "refer", "item", "technical",
    "questions", "please", "call",
  ]);

  const freq: Record<string, number> = {};
  for (const word of words) {
    if (!stopWords.has(word)) {
      freq[word] = (freq[word] || 0) + 1;
    }
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

async function extractTextChunks() {
  console.log("Extracting text from owner-manual.pdf...");
  const pdfBuffer = fs.readFileSync(path.join(FILES_DIR, "owner-manual.pdf"));
  const data = await pdfParse(pdfBuffer);

  const rawText: string = data.text;
  const totalLength = rawText.length;
  const numPages = data.numpages;

  // Split by "Page X" markers which appear in headers
  const pageRegex = /Page\s+(\d+)/g;
  const pagePositions: { page: number; pos: number }[] = [];
  let match;
  while ((match = pageRegex.exec(rawText)) !== null) {
    pagePositions.push({ page: parseInt(match[1]), pos: match.index });
  }

  const chunks: {
    id: string;
    pageNumber: number;
    section: string;
    content: string;
    keywords: string[];
  }[] = [];

  // Create chunks per page using the page markers
  for (let i = 0; i < pagePositions.length; i++) {
    const start = pagePositions[i].pos;
    const end =
      i + 1 < pagePositions.length ? pagePositions[i + 1].pos : totalLength;
    const pageNum = pagePositions[i].page;
    let pageText = rawText.slice(start, end).trim();

    // Strip the repeated header
    pageText = pageText.replace(
      /^Page\s+\d+For technical questions.*?Item 57812\s*/s,
      ""
    );
    pageText = pageText.trim();

    if (!pageText || pageText.length < 20) continue;

    const section = PAGE_SECTIONS[pageNum] || "General";

    // Split large pages into sub-chunks
    if (pageText.length > 2000) {
      const mid = pageText.indexOf("\n", Math.floor(pageText.length / 2));
      const splitPoint = mid > 0 ? mid : Math.floor(pageText.length / 2);

      chunks.push({
        id: `page-${String(pageNum).padStart(2, "0")}-a`,
        pageNumber: pageNum,
        section,
        content: pageText.slice(0, splitPoint).trim(),
        keywords: extractKeywords(pageText.slice(0, splitPoint)),
      });
      chunks.push({
        id: `page-${String(pageNum).padStart(2, "0")}-b`,
        pageNumber: pageNum,
        section,
        content: pageText.slice(splitPoint).trim(),
        keywords: extractKeywords(pageText.slice(splitPoint)),
      });
    } else {
      chunks.push({
        id: `page-${String(pageNum).padStart(2, "0")}`,
        pageNumber: pageNum,
        section,
        content: pageText,
        keywords: extractKeywords(pageText),
      });
    }
  }

  // Add content before first page marker (cover page)
  if (pagePositions.length > 0 && pagePositions[0].pos > 50) {
    const coverText = rawText.slice(0, pagePositions[0].pos).trim();
    if (coverText.length > 20) {
      chunks.unshift({
        id: "page-01",
        pageNumber: 1,
        section: "Cover",
        content: coverText,
        keywords: extractKeywords(coverText),
      });
    }
  }

  // Extract from quick start guide
  console.log("Extracting text from quick-start-guide.pdf...");
  const qsgBuffer = fs.readFileSync(
    path.join(FILES_DIR, "quick-start-guide.pdf")
  );
  const qsgData = await pdfParse(qsgBuffer);
  if (qsgData.text.trim()) {
    chunks.push({
      id: "quickstart",
      pageNumber: 0,
      section: "Quick Start Guide",
      content: qsgData.text.trim().slice(0, 3000),
      keywords: extractKeywords(qsgData.text),
    });
  }

  return chunks;
}

async function main() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  }

  const chunks = await extractTextChunks();
  fs.writeFileSync(
    path.join(KNOWLEDGE_DIR, "text-chunks.json"),
    JSON.stringify(chunks, null, 2)
  );
  console.log(`Wrote ${chunks.length} text chunks`);

  const sections: Record<string, number> = {};
  for (const c of chunks) {
    sections[c.section] = (sections[c.section] || 0) + 1;
  }
  console.log("\nSection distribution:");
  for (const [section, count] of Object.entries(sections).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${section}: ${count}`);
  }
}

main().catch(console.error);
