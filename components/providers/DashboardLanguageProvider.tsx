'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DASHBOARD_LANG_STORAGE_KEY, dashboardCopy, type DashboardLang } from '@/lib/dashboard-language';

type DashboardCopy = (typeof dashboardCopy)[DashboardLang];

type Ctx = {
  lang: DashboardLang;
  setLang: (lang: DashboardLang) => void;
  toggleLang: () => void;
  copy: DashboardCopy;
};

const DashboardLanguageContext = createContext<Ctx | null>(null);

export function DashboardLanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<DashboardLang>('zh');

  useEffect(() => {
    const stored = window.localStorage.getItem(DASHBOARD_LANG_STORAGE_KEY);
    if (stored === 'zh' || stored === 'en') setLang(stored);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DASHBOARD_LANG_STORAGE_KEY, lang);
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  const value = useMemo<Ctx>(() => ({
    lang,
    setLang,
    toggleLang: () => setLang((prev) => (prev === 'zh' ? 'en' : 'zh')),
    copy: dashboardCopy[lang],
  }), [lang]);

  return <DashboardLanguageContext.Provider value={value}>{children}</DashboardLanguageContext.Provider>;
}

export function useDashboardLanguage() {
  const ctx = useContext(DashboardLanguageContext);
  if (!ctx) throw new Error('useDashboardLanguage must be used within DashboardLanguageProvider');
  return ctx;
}
