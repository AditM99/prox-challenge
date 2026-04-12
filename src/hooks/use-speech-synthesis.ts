"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface UseSpeechSynthesisReturn {
  isSupported: boolean;
  isSpeaking: boolean;
  speak: (text: string) => void;
  stop: () => void;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "code block")    // code blocks
    .replace(/`([^`]+)`/g, "$1")                  // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")      // links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")     // images
    .replace(/#{1,6}\s+/g, "")                     // headers
    .replace(/\*\*([^*]+)\*\*/g, "$1")            // bold
    .replace(/\*([^*]+)\*/g, "$1")                // italic
    .replace(/__([^_]+)__/g, "$1")                // bold
    .replace(/_([^_]+)_/g, "$1")                  // italic
    .replace(/~~([^~]+)~~/g, "$1")                // strikethrough
    .replace(/\|/g, ", ")                          // table pipes
    .replace(/[-*+]\s+/g, "")                     // list markers
    .replace(/\d+\.\s+/g, "")                     // numbered lists
    .replace(/>\s+/g, "")                          // blockquotes
    .replace(/---+/g, "")                          // horizontal rules
    .replace(/\n{2,}/g, ". ")                      // double newlines → pause
    .replace(/\n/g, " ")                           // single newlines
    .replace(/\s{2,}/g, " ")                       // extra spaces
    .trim();
}

// Map language codes to BCP-47 tags for speech synthesis
const LANG_MAP: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-BR",
  zh: "zh-CN",
  ja: "ja-JP",
  ko: "ko-KR",
};

export function useSpeechSynthesis(language: string = "en"): UseSpeechSynthesisReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setIsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) return;

      window.speechSynthesis.cancel();

      const cleaned = stripMarkdown(text);
      if (!cleaned) return;

      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.lang = LANG_MAP[language] || "en-US";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Try to pick a voice matching the language
      const voices = window.speechSynthesis.getVoices();
      const langTag = LANG_MAP[language] || "en-US";
      const match = voices.find((v) => v.lang === langTag)
        || voices.find((v) => v.lang.startsWith(language));
      if (match) utterance.voice = match;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isSupported, language]
  );

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return { isSupported, isSpeaking, speak, stop };
}
