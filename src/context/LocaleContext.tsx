import React, { createContext, useContext, useEffect, useState } from "react";
import { locales, type Locale, type LocaleStrings } from "../i18n/locales";
import { setCurrentLanguage } from "../lib/apiClient";

interface LocaleContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: LocaleStrings;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: "en",
  setLocale: () => {},
  t: locales.en,
});

const LOCALE_STORAGE_KEY = "moni_hr_locale";
const DEFAULT_LOCALE: Locale = "en";

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored === "zh" || stored === "en" ? stored : DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());
  const t = locales[locale];
  const setLocale = (nextLocale: Locale) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    }
    setCurrentLanguage(nextLocale);
    setLocaleState(nextLocale);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
    setCurrentLanguage(locale);
  }, [locale]);

  console.log("[LocaleProvider] current locale:", locale);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
