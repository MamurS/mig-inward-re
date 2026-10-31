import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from '@/locales/en.json'
import ru from '@/locales/ru.json'
import uz from '@/locales/uz.json'
import { setNumberInputLanguage } from '@/lib/decimal'

export const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'ru', label: 'Русский', short: 'RU' },
  { code: 'uz', label: 'Oʻzbekcha', short: 'UZ' },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

// typed numbers are read in the interface language («1,5» is 1.5 in RU / UZ)
i18n.on('languageChanged', (lng) => setNumberInputLanguage(i18n.resolvedLanguage ?? lng))

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, ru: { translation: ru }, uz: { translation: uz } },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ru', 'uz'],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    // EN is the default; only a choice the user made (saved in localStorage) overrides it.
    detection: { order: ['localStorage'], lookupLocalStorage: 'mig.lang', caches: ['localStorage'] },
  })

export default i18n
