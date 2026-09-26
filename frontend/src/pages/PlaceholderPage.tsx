import { useTranslation } from "react-i18next";

type PlaceholderPageProps = {
  titleKey: string;
};

export function PlaceholderPage({ titleKey }: PlaceholderPageProps) {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="m-0 text-xl font-bold tracking-tight sm:text-2xl md:text-[1.65rem]">
        {t(titleKey)}
      </h1>
      <p className="mt-1.5 text-sm text-gray-500 md:text-[0.95rem]">
        {t("placeholder.comingSoon")}
      </p>
      <div className="mt-8 rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
        {t("placeholder.comingSoonHint")}
      </div>
    </div>
  );
}
