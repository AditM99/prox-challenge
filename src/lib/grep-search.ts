import type { TextChunk } from "./types";

interface SearchDirective {
  regex: RegExp;
  weight: number; // phrase = 2, bare term = 1
}

interface GrepSearchOptions {
  section?: string;
  limit?: number;
  caseSensitive?: boolean;
}

/**
 * Parse a search query into regex directives.
 * Quoted phrases become exact phrase matchers.
 * Bare terms get partial/stem matching (e.g. "volt" matches "voltage").
 * Terms shorter than 3 chars are filtered out.
 */
export function parseQuery(
  query: string,
  caseSensitive = false
): SearchDirective[] {
  const directives: SearchDirective[] = [];
  const flags = caseSensitive ? "" : "i";

  // Extract quoted phrases first
  const phraseRegex = /"([^"]+)"/g;
  let match: RegExpExecArray | null;
  const consumed = new Set<string>();

  while ((match = phraseRegex.exec(query)) !== null) {
    const phrase = match[1].trim();
    if (phrase.length < 3) continue;
    consumed.add(match[0]);
    try {
      // Replace spaces with flexible whitespace matcher
      const pattern = phrase
        .split(/\s+/)
        .map(escapeRegex)
        .join("\\s+");
      directives.push({
        regex: new RegExp(pattern, flags),
        weight: 2,
      });
    } catch {
      // Invalid regex — skip
    }
  }

  // Remove consumed phrases from query
  let remaining = query;
  for (const phrase of consumed) {
    remaining = remaining.replace(phrase, "");
  }

  // Split remaining into bare terms
  const terms = remaining
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);

  for (const term of terms) {
    try {
      // Partial/stem matching: "volt" matches "voltage", "voltmeter", etc.
      const escaped = escapeRegex(term);
      directives.push({
        regex: new RegExp(`${escaped}\\w*`, flags),
        weight: 1,
      });
    } catch {
      // Invalid regex — skip
    }
  }

  return directives;
}

/**
 * Score a chunk against search directives.
 */
function scoreChunk(chunk: TextChunk, directives: SearchDirective[]): number {
  if (directives.length === 0) return 0;

  let score = 0;
  const content = chunk.content;
  const keywords = chunk.keywords;
  const section = chunk.section;

  for (const directive of directives) {
    // Content matches — count occurrences
    const contentMatches = content.match(
      new RegExp(directive.regex.source, directive.regex.flags + "g")
    );
    if (contentMatches) {
      score += contentMatches.length * directive.weight;
    }

    // Keyword bonus: 3x if regex matches any keyword
    for (const kw of keywords) {
      if (directive.regex.test(kw)) {
        score += 3 * directive.weight;
        break; // one bonus per directive per chunk
      }
    }

    // Section title bonus: 2x
    if (directive.regex.test(section)) {
      score += 2 * directive.weight;
    }
  }

  // Density normalization — shorter focused chunks rank higher
  const densityFactor = content.length / 500;
  if (densityFactor > 1) {
    score = score / densityFactor;
  }

  return score;
}

/**
 * Grep-based search across text chunks.
 * Drop-in replacement for keyword-based search.
 */
export function grepSearch(
  chunks: TextChunk[],
  query: string,
  options: GrepSearchOptions = {}
): TextChunk[] {
  const { section, limit = 5, caseSensitive = false } = options;

  const directives = parseQuery(query, caseSensitive);
  if (directives.length === 0) return [];

  // Filter by section if specified
  let filtered = chunks;
  if (section) {
    const sectionLower = section.toLowerCase();
    filtered = chunks.filter((c) =>
      c.section.toLowerCase().includes(sectionLower)
    );
  }

  // Score and rank
  const scored = filtered
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, directives) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s) => s.chunk);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
