import type {
  TextChunk,
  ImageCatalogEntry,
  SelectionChartEntry,
  DutyCycleEntry,
  TroubleshootingFlow,
  TroubleshootingIndexEntry,
} from "./types";
import { semanticSearch } from "./semantic-search";

// Import JSON directly so webpack bundles them into serverless functions (works on Vercel)
import textChunksData from "../../knowledge/text-chunks.json";
import imageCatalogData from "../../knowledge/image-catalog.json";
import selectionChartDataRaw from "../../knowledge/selection-chart-data.json";
import dutyCycleDataRaw from "../../knowledge/duty-cycles.json";
import troubleshootingIndexData from "../../knowledge/troubleshooting/index.json";

export function getTextChunks(): TextChunk[] {
  return textChunksData as TextChunk[];
}

export function getImageCatalog(): ImageCatalogEntry[] {
  return imageCatalogData as ImageCatalogEntry[];
}

export function getSelectionChartData(): SelectionChartEntry[] {
  return selectionChartDataRaw as SelectionChartEntry[];
}

export function getDutyCycleData(): DutyCycleEntry[] {
  return dutyCycleDataRaw as DutyCycleEntry[];
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

import porosityFlow from "../../knowledge/troubleshooting/porosity.json";
import wireFeedFlow from "../../knowledge/troubleshooting/wire-feed-issues.json";
import noArcFlow from "../../knowledge/troubleshooting/no-arc.json";
import spatterFlow from "../../knowledge/troubleshooting/spatter.json";

const troubleshootingFlows: Record<string, TroubleshootingFlow> = {
  porosity: porosityFlow as unknown as TroubleshootingFlow,
  "wire-feed-issues": wireFeedFlow as unknown as TroubleshootingFlow,
  "no-arc": noArcFlow as unknown as TroubleshootingFlow,
  spatter: spatterFlow as unknown as TroubleshootingFlow,
};

export function getTroubleshootingIndex(): TroubleshootingIndexEntry[] {
  return troubleshootingIndexData as TroubleshootingIndexEntry[];
}

export function getTroubleshootingFlow(id: string): TroubleshootingFlow | null {
  return troubleshootingFlows[id] || null;
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
