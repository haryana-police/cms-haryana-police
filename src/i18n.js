import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enTranslations from './locales/en.json';
import hiTranslations from './locales/hi.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: enTranslations,
      hi: hiTranslations,
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React protects from XSS by default
    },
  });

export default i18n;
