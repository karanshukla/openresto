import { useTranslation } from "react-i18next";
import Select from "@/components/common/Select";
import { useLocale } from "@/context/LocaleContext";
import { LOCALE_LABELS, SUPPORTED_LOCALES, type SupportedLocale } from "@/constants/locales";

const LANGUAGE_OPTIONS = SUPPORTED_LOCALES.map((locale) => ({
  label: LOCALE_LABELS[locale],
  value: locale,
}));

/**
 * The one language picker in the app — guest footer and admin sidebar footer both render
 * this rather than hand-rolling their own. Writes through `LocaleContext.setLocale`, which
 * persists the pick to `localStorage["openresto.locale"]` and applies it live (i18next +
 * `setActiveLocale`, so date/time formatting follows the switch immediately, not just text).
 */
export default function LanguageSwitcher() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();

  return (
    <Select
      icon="language-outline"
      options={LANGUAGE_OPTIONS}
      selectedValue={locale}
      onSelect={(value) => setLocale(value as SupportedLocale)}
      accessibilityLabel={t("common.language.switcherLabel")}
    />
  );
}
