"use client";

import { useState, useEffect, useCallback } from "react";
import {
  type LanguageCode,
  getTranslation,
  getStoredLanguage,
  setStoredLanguage,
} from "@/lib/i18n";

export function useLanguage() {
  const [language, setLanguageState] = useState<LanguageCode>("en");

  useEffect(() => {
    setLanguageState(getStoredLanguage());
  }, []);

  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState(lang);
    setStoredLanguage(lang);
  }, []);

  const t = useCallback(
    (key: string) => getTranslation(language, key),
    [language]
  );

  return { language, setLanguage, t };
}
