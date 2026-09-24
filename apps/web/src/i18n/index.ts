import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import pl from './pl.json';

export type Lang = 'pl' | 'en';
export const LANG_KEY = 'tayan.lang';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { pl: { translation: pl }, en: { translation: en } },
    supportedLngs: ['pl', 'en'],
    fallbackLng: 'en',
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANG_KEY,
      caches: ['localStorage'],
    },
  });

export function currentLang(): Lang {
  return i18n.language?.startsWith('pl') ? 'pl' : 'en';
}

export default i18n;
