/**
 * Mirrors the backend's `SupportedLocales` allow-list, the same way `constants/roles.ts`
 * mirrors the backend role matrix. Adding a language is one entry here, one entry in
 * `SupportedLocales.cs`, and one JSON file under `locales/`.
 */
export const SUPPORTED_LOCALES = ["en", "fr", "es", "de"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** The locale served when nothing configured resolves to a supported value. */
export const DEFAULT_LOCALE: SupportedLocale = "en";

/**
 * Each label is written in its OWN language, not translated — the convention every
 * language picker on the web uses, so a viewer who cannot read the current UI language
 * can still find theirs.
 */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  de: "Deutsch",
};

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Writing direction per supported language. Uniform today because every language shipped is
 * LTR — it exists so adding an RTL language is the same one-entry change here that adding any
 * other language is, rather than direction being decided somewhere else.
 */
export const LOCALE_DIRECTIONS: Record<SupportedLocale, "ltr" | "rtl"> = {
  en: "ltr",
  fr: "ltr",
  es: "ltr",
  de: "ltr",
};
