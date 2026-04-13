export interface TextChunk {
  id: string;
  pageNumber: number;
  section: string;
  content: string;
  keywords: string[];
}

export interface ImageCatalogEntry {
  id: string;
  path: string;
  pageNumber: number;
  description: string;
  tags: string[];
}

export interface SelectionChartEntry {
  process: string;
  material: string;
  thickness: string;
  wire: string;
  wireDiameter: string;
  gas: string;
  voltage: string;
  wireSpeed: string;
  amperage: string;
}

export interface DutyCycleEntry {
  process: string;
  voltage: string;
  ratedAmps: number;
  dutyCyclePercent: number;
  continuousAmps: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: { url: string; description: string; pageNumber?: number }[];
  artifacts?: { type: string; title: string; code: string }[];
  attachedImages?: { base64: string; mimeType: string }[];
  isStreaming?: boolean;
}

export interface UploadedProduct {
  sessionId: string;
  productName: string;
  files: { name: string; type: string; size: number }[];
  chunks: TextChunk[];
  uploadedImages: { id: string; name: string; base64: string; mimeType: string }[];
  originalFile?: { base64: string; mimeType: string; name: string };
  sourceUrl?: string;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  title: string;
  productName: string;
  productCategory?: string;
  productImage?: string | null;
  productSessionId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface UserMemory {
  expertiseLevel: "beginner" | "intermediate" | "expert" | null;
  frequentTopics: string[];
  preferredDetailLevel: "concise" | "detailed" | null;
  productsUsed: string[];
  interactionCount: number;
  customNotes: string[];
  lastUpdated: number;
}

export interface TroubleshootingStep {
  question?: string;
  options?: { label: string; next: string }[];
  type?: "resolution";
  title?: string;
  fix?: string;
  reference?: string;
}

export interface TroubleshootingFlow {
  id: string;
  title: string;
  description: string;
  steps: Record<string, TroubleshootingStep>;
}

export interface TroubleshootingIndexEntry {
  id: string;
  title: string;
  keywords: string[];
}

export type SSEEvent =
  | { type: "text"; content: string }
  | { type: "tool_call"; name: string; input: Record<string, unknown> }
  | { type: "image"; url: string; description: string; pageNumber?: number }
  | { type: "artifact"; artifactType: string; title: string; code: string }
  | { type: "memory_update"; memory: Partial<UserMemory> }
  | { type: "done" }
  | { type: "error"; message: string };
