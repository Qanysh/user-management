import { useTranslation } from "react-i18next";

import type { AppLang } from "./index";
import { SUPPORTED_LANGS } from "./index";

const LABELS: Record<AppLang, string> = {
  ru: "Рус",
  kk: "Қаз",
  en: "Eng",
};

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { i18n, t } = useTranslation();
  const current = (SUPPORTED_LANGS.includes(i18n.language as AppLang)
    ? i18n.language
    : "ru") as AppLang;

  return (
    <div
      className={`inline-flex rounded-[10px] border border-gray-200 bg-white p-0.5 ${className}`}
      role="group"
      aria-label={t("lang.label")}
    >
      {SUPPORTED_LANGS.map((code) => (
        <button
          key={code}
          type="button"
          className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold transition sm:px-2.5 sm:text-xs ${
            current === code
              ? "bg-primary text-white"
              : "bg-transparent text-gray-600 hover:bg-gray-50"
          }`}
          onClick={() => void i18n.changeLanguage(code)}
        >
          {LABELS[code]}
        </button>
      ))}
    </div>
  );
}
