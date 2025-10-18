import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from './src/locales/en/translation.json';
import viTranslations from './src/locales/vi/translation.json';

const fallbackTranslation = (key: string) => {
  const segments = key.split('.');
  return segments[segments.length - 1] ?? key;
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      vi: { translation: viTranslations },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    load: 'languageOnly',
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    returnNull: false,
    parseMissingKeyHandler: fallbackTranslation,
    missingKeyHandler: (_lng, _ns, key) => fallbackTranslation(key),
  });

export default i18n;
