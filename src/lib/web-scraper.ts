import * as cheerio from "cheerio";
import type { TextChunk } from "./types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface ManualContent {
  source: string;
  chunks: TextChunk[];
}

/**
 * Search DuckDuckGo for a product manual and extract its content.
 */
export async function findAndExtractManual(
  productName: string
): Promise<ManualContent> {
  // Step 1: Search for the manual
  const results = await searchForManual(productName);

  if (results.length === 0) {
    throw new Error(
      `Couldn't find a manual for "${productName}". Try uploading the manual directly.`
    );
  }

  // Step 2: Try each result until we get content
  let lastError = "";
  for (const result of results.slice(0, 3)) {
    try {
      const chunks = await fetchAndExtract(result.url, productName);
      if (chunks.length > 0) {
        return { source: result.url, chunks };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Extraction failed";
    }
  }

  throw new Error(
    `Found search results but couldn't extract manual content. ${lastError}`
  );
}

/**
 * Search DuckDuckGo HTML for product manual links.
 */
export async function searchForManual(productName: string): Promise<SearchResult[]> {
  const queries = [
    `${productName} owner's manual PDF`,
    `${productName} user manual`,
    `${productName} manual site:manualslib.com`,
  ];

  for (const query of queries) {
    try {
      const results = await duckDuckGoSearch(query);
      if (results.length > 0) return results;
    } catch {
      // Try next query
    }
  }

  return [];
}

/**
 * General-purpose web search via DuckDuckGo (no API key needed).
 */
export async function webSearch(query: string): Promise<SearchResult[]> {
  return duckDuckGoSearch(query);
}

/**
 * Fetch a URL and return cleaned plain text (truncated to ~2000 chars).
 */
export async function fetchPageSnippet(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html, */*",
      },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });

    if (!response.ok) return "";

    const html = await response.text();
    const $ = cheerio.load(html);

    $("script, style, nav, footer, header, aside, .ad, .sidebar, .menu, .nav").remove();

    const mainContent =
      $("main, article, .content, #content, .post-content").first();
    const textSource = mainContent.length > 0 ? mainContent : $("body");

    const text = textSource
      .text()
      .replace(/\s+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return text.slice(0, 2000);
  } catch {
    return "";
  }
}

/**
 * DuckDuckGo HTML search (no API key needed).
 */
async function duckDuckGoSearch(query: string): Promise<SearchResult[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://html.duckduckgo.com/html/?q=${encoded}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const results: SearchResult[] = [];

  $(".result").each((_, el) => {
    const titleEl = $(el).find(".result__title a");
    const snippetEl = $(el).find(".result__snippet");
    const href = titleEl.attr("href") || "";

    // DuckDuckGo wraps URLs in a redirect
    let resultUrl = href;
    const uddgMatch = href.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      resultUrl = decodeURIComponent(uddgMatch[1]);
    }

    if (resultUrl && resultUrl.startsWith("http")) {
      results.push({
        title: titleEl.text().trim(),
        url: resultUrl,
        snippet: snippetEl.text().trim(),
      });
    }
  });

  return results;
}

/**
 * Fetch a URL and extract text content (PDF or HTML).
 */
export async function fetchAndExtract(
  url: string,
  productName: string
): Promise<TextChunk[]> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/pdf, text/html, */*",
    },
    signal: AbortSignal.timeout(30000),
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const buffer = Buffer.from(await response.arrayBuffer());
  console.log(`[scraper] Fetched ${url} — ${contentType}, ${buffer.length} bytes`);

  // Check if it's a PDF (by content-type or magic bytes)
  if (
    contentType.includes("pdf") ||
    buffer.slice(0, 5).toString() === "%PDF-"
  ) {
    return extractPdfText(buffer, url);
  }

  // Otherwise treat as HTML
  return extractHtmlText(buffer.toString("utf-8"), url, productName);
}

/**
 * Extract text from a PDF buffer into chunks.
 */
async function extractPdfText(
  buffer: Buffer,
  source: string
): Promise<TextChunk[]> {
  const data = await pdfParse(buffer);
  const text: string = data.text;

  if (!text || text.trim().length < 50) {
    return [];
  }

  return chunkText(text, source);
}

/**
 * Extract meaningful text from an HTML page.
 */
function extractHtmlText(
  html: string,
  source: string,
  productName: string
): TextChunk[] {
  const $ = cheerio.load(html);

  // Remove noise
  $("script, style, nav, footer, header, aside, .ad, .sidebar, .menu, .nav").remove();

  // Get main content area or body
  const mainContent =
    $("main, article, .content, .manual-content, #content, .post-content").first();
  const textSource = mainContent.length > 0 ? mainContent : $("body");

  const text = textSource
    .text()
    .replace(/\s+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text || text.length < 100) {
    return [];
  }

  // Check if the page is actually about the product (basic relevance check)
  const lowerText = text.toLowerCase();
  const productTerms = productName.toLowerCase().split(/\s+/);
  const matchCount = productTerms.filter((t) =>
    lowerText.includes(t)
  ).length;

  if (matchCount === 0) {
    console.log(`[scraper] Page not relevant — no product terms found in ${text.length} chars`);
    return []; // Not relevant at all
  }

  return chunkText(text, source);
}

/**
 * Split text into ~1500 char chunks.
 */
function chunkText(text: string, source: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  const paragraphs = text.split(/\n{2,}|\.\s{2,}/);

  let current = "";
  let idx = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    current += trimmed + "\n\n";

    if (current.length > 1500) {
      chunks.push({
        id: `web-${String(++idx).padStart(3, "0")}`,
        pageNumber: idx,
        section: source,
        content: current.trim(),
        keywords: extractKeywords(current),
      });
      current = "";
    }
  }

  if (current.trim()) {
    chunks.push({
      id: `web-${String(++idx).padStart(3, "0")}`,
      pageNumber: idx,
      section: source,
      content: current.trim(),
      keywords: extractKeywords(current),
    });
  }

  return chunks;
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
