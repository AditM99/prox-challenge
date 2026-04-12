"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ChatMessage, ChatSession } from "@/lib/types";

const INDEX_KEY = "prox-sessions";
const MSG_PREFIX = "prox-session-";
const MAX_SESSIONS = 50;

function loadIndex(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveIndex(sessions: ChatSession[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(sessions));
  } catch {
    // quota exceeded — prune oldest
    const pruned = sessions.slice(0, Math.floor(sessions.length / 2));
    for (const s of sessions.slice(Math.floor(sessions.length / 2))) {
      localStorage.removeItem(MSG_PREFIX + s.id);
    }
    localStorage.setItem(INDEX_KEY, JSON.stringify(pruned));
  }
}

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loaded = loadIndex().sort((a, b) => b.updatedAt - a.updatedAt);
    setSessions(loaded);
  }, []);

  const createSession = useCallback(
    (productName: string, productSessionId: string | null, productCategory?: string, productImage?: string | null): string => {
      const id = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const session: ChatSession = {
        id,
        title: productName,
        productName,
        productCategory,
        productImage,
        productSessionId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setSessions((prev) => {
        const updated = [session, ...prev].slice(0, MAX_SESSIONS);
        saveIndex(updated);
        return updated;
      });

      setActiveSessionId(id);
      return id;
    },
    []
  );

  const loadMessages = useCallback((id: string): ChatMessage[] => {
    try {
      const raw = localStorage.getItem(MSG_PREFIX + id);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  const saveMessages = useCallback(
    (id: string, messages: ChatMessage[]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        try {
          // Strip streaming state before saving
          const cleaned = messages.map((m) => ({ ...m, isStreaming: undefined }));
          localStorage.setItem(MSG_PREFIX + id, JSON.stringify(cleaned));
        } catch {
          // quota exceeded — silent fail
        }

        // Update title and timestamp in index
        setSessions((prev) => {
          const updated = prev.map((s) => {
            if (s.id !== id) return s;
            const firstUserMsg = messages.find((m) => m.role === "user");
            const title = firstUserMsg
              ? firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? "..." : "")
              : s.title;
            return { ...s, title, updatedAt: Date.now() };
          });
          updated.sort((a, b) => b.updatedAt - a.updatedAt);
          saveIndex(updated);
          return updated;
        });
      }, 500);
    },
    []
  );

  const deleteSession = useCallback((id: string) => {
    localStorage.removeItem(MSG_PREFIX + id);
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveIndex(updated);
      return updated;
    });
    setActiveSessionId((current) => (current === id ? null : current));
  }, []);

  return {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    loadMessages,
    saveMessages,
    deleteSession,
  };
}
