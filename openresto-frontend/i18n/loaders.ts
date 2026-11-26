import type en from "@/locales/en.json";
import type { SupportedLocale } from "@/constants/locales";

/**
 * Every locale except English, each as its own chunk that Metro splits out of the web bundle, so a
 * visitor downloads only the language they read. English is bundled because it is the fallback.
 */
export const localeLoaders: Record<
  Exclude<SupportedLocale, "en">,
  () => Promise<{ default: typeof en }>
> = {
  fr: () => import("@/locales/fr.json"),
  es: () => import("@/locales/es.json"),
  de: () => import("@/locales/de.json"),
  nl: () => import("@/locales/nl.json"),
};
