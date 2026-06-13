import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { translations, type Lang } from '@/i18n/translations';

const STORAGE_KEY = 'app.lang';

type I18nValue = {
  lang: Lang;
  isRtl: boolean;
  setLang: (lang: Lang) => void;
  toggle: () => void;
  t: (key: string, fallback?: string) => string;
};

const I18nContext = createContext<I18nValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value === 'en' || value === 'ur') setLangState(value);
      })
      .catch(() => {});
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    setLangState((prev) => {
      const next: Lang = prev === 'en' ? 'ur' : 'en';
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) =>
      translations[lang][key] ?? translations.en[key] ?? fallback ?? key,
    [lang],
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, isRtl: lang === 'ur', setLang, toggle, t }),
    [lang, setLang, toggle, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within LanguageProvider');
  return ctx;
}
