import React, { createContext, useContext, useState } from "react";
import { locales, type Locale, type LocaleStrings } from "../i18n/locales";

interface LocaleContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: LocaleStrings;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: "zh",
  setLocale: () => {},
  t: locales.zh,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("zh");
  const t = locales[locale];

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
