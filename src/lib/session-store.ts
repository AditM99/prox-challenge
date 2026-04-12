import type { UploadedProduct } from "./types";

// Use globalThis to survive Next.js hot reloads in dev mode
const globalStore = globalThis as unknown as {
  __prox_sessions?: Map<string, UploadedProduct>;
};

if (!globalStore.__prox_sessions) {
  globalStore.__prox_sessions = new Map<string, UploadedProduct>();
}

const sessions = globalStore.__prox_sessions;

// Auto-cleanup sessions older than 2 hours
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > MAX_AGE_MS) {
      sessions.delete(id);
    }
  }
}

export function createSession(data: UploadedProduct): void {
  cleanup();
  sessions.set(data.sessionId, data);
}

export function getSession(sessionId: string): UploadedProduct | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() - session.createdAt > MAX_AGE_MS) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
