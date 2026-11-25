import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LOCALE } from "@/constants/locales";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import es from "@/locales/es.json";
import de from "@/locales/de.json";
import nl from "@/locales/nl.json";

/**
 * Locale JSONs are imported statically and bundled inline — no `i18next-http-backend`.
 * At a small number of locales that is a smaller payload than one extra network
 * round trip, and it keeps the runtime language switch instant (no fetch to wait on). Revisit
 * past ~8 languages.
 */
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    es: { translation: es },
    de: { translation: de },
    nl: { translation: nl },
  },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  interpolation: {
    escapeValue: false, // React Native does no HTML escaping, unlike the DOM i18next targets by default.
  },
  react: {
    useSuspense: false, // No Suspense boundary at the root — the locale resolves after first paint.
  },
});

export default i18n;
