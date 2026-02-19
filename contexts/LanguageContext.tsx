import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import i18n from '../i18n';

type Language = 'en' | 'ar';
type Direction = 'ltr' | 'rtl';

interface LanguageContextType {
  language: Language;
  direction: Direction;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [direction, setDirection] = useState<Direction>('ltr');

  useEffect(() => {
    // Sync i18n with state on mount
    const currentLang = i18n.language as Language;
    if (currentLang) {
        setLanguageState(currentLang);
        updateDirection(currentLang);
    }
  }, []);

  const updateDirection = (lang: Language) => {
      const dir = lang === 'ar' ? 'rtl' : 'ltr';
      setDirection(dir);
      document.documentElement.dir = dir;
      document.documentElement.lang = lang;
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    updateDirection(lang);
    i18n.changeLanguage(lang);
  };

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'ar' : 'en';
    setLanguage(newLang);
  };

  return (
    <LanguageContext.Provider value={{ language, direction, toggleLanguage, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    if (typeof window !== 'undefined') {
      console.warn('useLanguage called outside LanguageProvider, using safe defaults.');
    }

    return {
      language: 'en' as Language,
      direction: 'ltr' as Direction,
      toggleLanguage: () => undefined,
      setLanguage: () => undefined,
    };
  }
  return context;
};
