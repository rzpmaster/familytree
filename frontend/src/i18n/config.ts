import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import zh from './locales/zh';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'zh',
    debug: false,
    resources: {
      zh,
      en
    },
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    lng:'zh'
  });

export default i18n;
