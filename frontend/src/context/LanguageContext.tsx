import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type Language = 'bn' | 'en';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (bn: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANG_STORAGE_KEY = 'amader_krishi_lang_pref';

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Default to Bangla-first
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    return saved === 'en' ? 'en' : 'bn';
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem(LANG_STORAGE_KEY, newLang);
    document.documentElement.lang = newLang;
  };

  const toggleLang = () => {
    setLang(lang === 'bn' ? 'en' : 'bn');
  };

  const t = (bnText: string, enText: string): string => {
    return lang === 'bn' ? bnText : enText;
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
