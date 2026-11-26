import i18n, { type BackendModule } from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LOCALE } from "@/constants/locales";
import { localeLoaders } from "@/i18n/loaders";
import en from "@/locales/en.json";

/**
 * Fetches a non-English locale the first time i18next needs it, so `changeLanguage` and
 * `loadLanguages` resolve once its translations are in.
 */
const lazyLocales: BackendModule = {
  type: "backend",
  init() {},
  read(language, _namespace, callback) {
    const load = localeLoaders[language as keyof typeof localeLoaders];
    if (!load) {
      callback(new Error(`No translations for "${language}"`), false);
      return;
    }
    load().then(
      (module) => callback(null, module.default),
      (error) => callback(error, false)
    );
  },
};

i18n
  .use(lazyLocales)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en } },
    partialBundledLanguages: true,
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
