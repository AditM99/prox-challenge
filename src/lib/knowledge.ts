import fs from "fs";
import path from "path";
import type {
  TextChunk,
  ImageCatalogEntry,
  SelectionChartEntry,
  DutyCycleEntry,
  TroubleshootingFlow,
  TroubleshootingIndexEntry,
} from "./types";
import { semanticSearch } from "./semantic-search";

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");

let textChunks: TextChunk[] | null = null;
let imageCatalog: ImageCatalogEntry[] | null = null;
let selectionChartData: SelectionChartEntry[] | null = null;
let dutyCycleData: DutyCycleEntry[] | null = null;

function loadJSON<T>(filename: string): T {
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export function getTextChunks(): TextChunk[] {
  if (!textChunks) {
    textChunks = loadJSON<TextChunk[]>("text-chunks.json");
  }
  return textChunks;
}

export function getImageCatalog(): ImageCatalogEntry[] {
  if (!imageCatalog) {
    imageCatalog = loadJSON<ImageCatalogEntry[]>("image-catalog.json");
  }
  return imageCatalog;
}

export function getSelectionChartData(): SelectionChartEntry[] {
  if (!selectionChartData) {
    selectionChartData = loadJSON<SelectionChartEntry[]>(
      "selection-chart-data.json"
    );
  }
  return selectionChartData;
}

export function getDutyCycleData(): DutyCycleEntry[] {
  if (!dutyCycleData) {
    dutyCycleData = loadJSON<DutyCycleEntry[]>("duty-cycles.json");
  }
  return dutyCycleData;
}

export async function searchTextChunks(
  query: string,
  section?: string,
  limit: number = 5
): Promise<TextChunk[]> {
  return semanticSearch(getTextChunks(), query, { section, limit });
}

export function searchImageCatalog(
  query: string,
  limit: number = 1
): ImageCatalogEntry[] {
  const catalog = getImageCatalog();
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const scored = catalog
    .map((entry) => {
      const descLower = entry.description.toLowerCase();
      const tagsLower = entry.tags.map((t) => t.toLowerCase());

      let score = 0;
      for (const term of queryTerms) {
        if (tagsLower.some((t) => t.includes(term))) score += 3;
        if (descLower.includes(term)) score += 2;
      }

      return { entry, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s) => s.entry);
}

export function querySelectionChart(
  process?: string,
  material?: string,
  thickness?: string
): SelectionChartEntry[] {
  let data = getSelectionChartData();

  if (process) {
    data = data.filter((d) =>
      d.process.toLowerCase().includes(process.toLowerCase())
    );
  }
  if (material) {
    data = data.filter((d) =>
      d.material.toLowerCase().includes(material.toLowerCase())
    );
  }
  if (thickness) {
    data = data.filter((d) =>
      d.thickness.toLowerCase().includes(thickness.toLowerCase())
    );
  }

  return data;
}

export function queryDutyCycles(
  process?: string,
  voltage?: string
): DutyCycleEntry[] {
  let data = getDutyCycleData();

  if (process) {
    data = data.filter((d) =>
      d.process.toLowerCase().includes(process.toLowerCase())
    );
  }
  if (voltage) {
    data = data.filter((d) => d.voltage.includes(voltage));
  }

  return data;
}

// ─── Troubleshooting ───

let troubleshootingIndex: TroubleshootingIndexEntry[] | null = null;

export function getTroubleshootingIndex(): TroubleshootingIndexEntry[] {
  if (!troubleshootingIndex) {
    troubleshootingIndex = loadJSON<TroubleshootingIndexEntry[]>(
      "troubleshooting/index.json"
    );
  }
  return troubleshootingIndex;
}

export function getTroubleshootingFlow(id: string): TroubleshootingFlow | null {
  try {
    return loadJSON<TroubleshootingFlow>(`troubleshooting/${id}.json`);
  } catch {
    return null;
  }
}

export function findTroubleshootingFlow(query: string): TroubleshootingFlow | null {
  const index = getTroubleshootingIndex();
  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  let bestMatch: TroubleshootingIndexEntry | null = null;
  let bestScore = 0;

  for (const entry of index) {
    let score = 0;
    for (const term of queryTerms) {
      for (const kw of entry.keywords) {
        if (kw.includes(term) || term.includes(kw)) score += 2;
      }
      if (entry.title.toLowerCase().includes(term)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  if (!bestMatch || bestScore < 2) return null;
  return getTroubleshootingFlow(bestMatch.id);
}
