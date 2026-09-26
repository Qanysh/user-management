import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import kk from "./locales/kk.json";
import ru from "./locales/ru.json";

export const SUPPORTED_LANGS = ["ru", "kk", "en"] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];

const STORAGE_KEY = "app_lang";

function resolveInitialLang(): AppLang {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "ru" || saved === "kk" || saved === "en") {
    return saved;
  }
  const browser = navigator.language.toLowerCase();
  if (browser.startsWith("kk")) return "kk";
  if (browser.startsWith("en")) return "en";
  return "ru";
}

void i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    kk: { translation: kk },
    en: { translation: en },
  },
  lng: resolveInitialLang(),
  fallbackLng: "ru",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
  document.documentElement.lang = lng;
});

document.documentElement.lang = i18n.language;

export default i18n;
