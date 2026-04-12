"use client";

import { useState, useCallback, useEffect } from "react";
import type { UserMemory } from "@/lib/types";

const STORAGE_KEY = "prox-user-memory";

const DEFAULT_MEMORY: UserMemory = {
  expertiseLevel: null,
  frequentTopics: [],
  preferredDetailLevel: null,
  productsUsed: [],
  interactionCount: 0,
  customNotes: [],
  lastUpdated: 0,
};

function loadMemory(): UserMemory {
  if (typeof window === "undefined") return { ...DEFAULT_MEMORY };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MEMORY };
    return { ...DEFAULT_MEMORY, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_MEMORY };
  }
}

function saveMemory(memory: UserMemory) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Storage full or unavailable
  }
}

export function useUserMemory() {
  const [memory, setMemory] = useState<UserMemory>(() => loadMemory());

  // Sync state from localStorage on mount (handles SSR hydration)
  useEffect(() => {
    setMemory(loadMemory());
  }, []);

  const updateMemory = useCallback((partial: Partial<UserMemory>) => {
    setMemory((prev) => {
      const updated: UserMemory = { ...prev, ...partial, lastUpdated: Date.now() };

      // Merge array fields instead of replacing
      if (partial.frequentTopics) {
        const merged = [...new Set([...prev.frequentTopics, ...partial.frequentTopics])];
        updated.frequentTopics = merged.slice(-10); // keep max 10
      }
      if (partial.productsUsed) {
        updated.productsUsed = [...new Set([...prev.productsUsed, ...partial.productsUsed])];
      }
      if (partial.customNotes) {
        const merged = [...new Set([...prev.customNotes, ...partial.customNotes])];
        updated.customNotes = merged.slice(-5); // keep max 5
      }

      saveMemory(updated);
      return updated;
    });
  }, []);

  const addTopic = useCallback((topic: string) => {
    setMemory((prev) => {
      const topics = [...new Set([...prev.frequentTopics, topic])].slice(-10);
      const updated = { ...prev, frequentTopics: topics, lastUpdated: Date.now() };
      saveMemory(updated);
      return updated;
    });
  }, []);

  const incrementInteractionCount = useCallback(() => {
    setMemory((prev) => {
      const updated = { ...prev, interactionCount: prev.interactionCount + 1, lastUpdated: Date.now() };
      saveMemory(updated);
      return updated;
    });
  }, []);

  const addProduct = useCallback((product: string) => {
    setMemory((prev) => {
      if (prev.productsUsed.includes(product)) return prev;
      const updated = { ...prev, productsUsed: [...prev.productsUsed, product], lastUpdated: Date.now() };
      saveMemory(updated);
      return updated;
    });
  }, []);

  const resetMemory = useCallback(() => {
    const fresh = { ...DEFAULT_MEMORY };
    setMemory(fresh);
    saveMemory(fresh);
  }, []);

  return {
    memory,
    updateMemory,
    addTopic,
    incrementInteractionCount,
    addProduct,
    resetMemory,
  };
}
