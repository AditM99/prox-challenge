import type { TextChunk } from "./types";
import { grepSearch } from "./grep-search";

interface SemanticSearchOptions {
  section?: string;
  limit?: number;
  grepLimit?: number;
}

/**
 * 2-stage retrieval: grep narrows to pages, TF-IDF reranks.
 * Stage 1: grep finds top chunks → extract page numbers
 * Stage 2: gather ALL chunks from those pages → TF-IDF cosine similarity rerank
 */
export async function semanticSearch(
  chunks: TextChunk[],
  query: string,
  options: SemanticSearchOptions = {}
): Promise<TextChunk[]> {
  const { section, limit = 5, grepLimit = 10 } = options;

  // Stage 1: grep search to find the right pages
  const grepResults = grepSearch(chunks, query, { section, limit: grepLimit });

  if (grepResults.length === 0) return [];

  // Expand to all chunks on the matched pages
  const pageChunks = expandToPages(chunks, grepResults);

  // If only a few chunks, skip reranking
  if (pageChunks.length <= limit) return pageChunks;

  // Stage 2: TF-IDF cosine similarity rerank
  const corpus = pageChunks.map((c) => c.content);
  const queryVec = tfidfVector(query, corpus);
  const chunkVecs = corpus.map((doc) => tfidfVector(doc, corpus));

  const scored = pageChunks
    .map((chunk, i) => ({
      chunk,
      similarity: cosineSimilarity(queryVec, chunkVecs[i]),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return scored.map((s) => s.chunk);
}

/**
 * Gather all chunks from the same pages as the grep results.
 */
function expandToPages(allChunks: TextChunk[], grepResults: TextChunk[]): TextChunk[] {
  const pageNumbers = new Set(grepResults.map((c) => c.pageNumber));
  return allChunks.filter((c) => pageNumbers.has(c.pageNumber));
}

// ─── TF-IDF ───

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "as", "into", "through", "during",
  "before", "after", "and", "but", "or", "nor", "not", "so", "yet",
  "both", "either", "neither", "each", "every", "all", "any", "few",
  "more", "most", "other", "some", "such", "no", "only", "own", "same",
  "than", "too", "very", "just", "because", "about", "between", "under",
  "this", "that", "these", "those", "it", "its", "if", "then", "also",
  "up", "out", "how", "what", "when", "where", "which", "who", "whom",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  // Normalize by document length
  const len = tokens.length || 1;
  for (const [term, count] of tf) {
    tf.set(term, count / len);
  }
  return tf;
}

function inverseDocFrequency(corpus: string[][]): Map<string, number> {
  const idf = new Map<string, number>();
  const n = corpus.length;

  for (const doc of corpus) {
    const seen = new Set(doc);
    for (const term of seen) {
      idf.set(term, (idf.get(term) || 0) + 1);
    }
  }

  for (const [term, df] of idf) {
    idf.set(term, Math.log((n + 1) / (df + 1)) + 1);
  }

  return idf;
}

/**
 * Build a TF-IDF vector for a document given the corpus for IDF computation.
 * Returns a sparse vector as a Map<term, weight>.
 */
function tfidfVector(text: string, corpus: string[]): Map<string, number> {
  const tokens = tokenize(text);
  const tf = termFrequency(tokens);
  const corpusTokenized = corpus.map(tokenize);
  // Include the query in IDF computation
  corpusTokenized.push(tokens);
  const idf = inverseDocFrequency(corpusTokenized);

  const vec = new Map<string, number>();
  for (const [term, tfVal] of tf) {
    const idfVal = idf.get(term) || 0;
    vec.set(term, tfVal * idfVal);
  }
  return vec;
}

/**
 * Cosine similarity between two sparse vectors.
 */
function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const [term, val] of a) {
    magA += val * val;
    const bVal = b.get(term);
    if (bVal !== undefined) dot += val * bVal;
  }
  for (const [, val] of b) {
    magB += val * val;
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude === 0 ? 0 : dot / magnitude;
}
