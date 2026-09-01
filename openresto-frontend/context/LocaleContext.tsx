import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { getLocales } from "expo-localization";
import i18n from "@/i18n";
import { setActiveLocale } from "@/utils/locale";
import { StorageService } from "@/services/storage";
import { useBrand } from "@/context/BrandContext";
import {
  DEFAULT_LOCALE,
  LOCALE_DIRECTIONS,
  isSupportedLocale,
  type SupportedLocale,
} from "@/constants/locales";

const STORAGE_KEY = "openresto.locale";

/**
 * The phone's own language, off web only, and only when this app ships it.
 *
 * @see [LocaleContext.native.test.tsx](../tests/context/LocaleContext.native.test.tsx) — pins
 * that a device set to a shipped language wins over the brand default, and that a device set
 * to one this app does not ship falls through to it.
 */
function deviceLocale(): SupportedLocale | undefined {
  if (Platform.OS === "web") return undefined;
  const languageCode = getLocales()[0]?.languageCode;
  return isSupportedLocale(languageCode) ? languageCode : undefined;
}

/**
 * Resolution order, highest priority first:
 *  1. The viewer's own pick, in `localStorage["openresto.locale"]`, written by `setLocale`
 *     below — the admin sidebar's `LanguageSwitcher`, the guest navbar's overflow menu and
 *     the native guest settings sheet all go through it. A value outside `SUPPORTED_LOCALES`
 *     is ignored, not trusted.
 *  2. The device locale, **off web only**. An installed app is expected to follow the phone's
 *     language; a website is expected to follow the restaurant's, which is why the same step
 *     is absent on web — a restaurant that sets `fr` wants `fr` for every visitor, and the
 *     switcher is the escape hatch for the tourist.
 *  3. `brand.defaultLocale`, the self-hoster's `Locale:Default` / `OPENRESTO_DEFAULT_LOCALE`.
 *  4. `DEFAULT_LOCALE` ("en"), hardcoded.
 *
 * @see [LocaleContext.test.tsx](../tests/context/LocaleContext.test.tsx) — pins the web order,
 * device locale included.
 */
function resolveLocale(brandDefaultLocale: string | undefined): SupportedLocale {
  const stored = StorageService.getItem(STORAGE_KEY);
  if (isSupportedLocale(stored)) return stored;
  return (
    deviceLocale() ?? (isSupportedLocale(brandDefaultLocale) ? brandDefaultLocale : DEFAULT_LOCALE)
  );
}

interface LocaleContextValue {
  locale: SupportedLocale;
  /**
   * The language switcher's write path: persists the pick to
   * `localStorage["openresto.locale"]` (so it wins the resolution order on the next visit),
   * updates the context so every `useLocale()` consumer re-renders, and applies it live via
   * `applyLocale` — the same i18next + `setActiveLocale` pair the initial resolution uses, so
   * switching languages re-formats dates/times immediately rather than only retranslating text.
   */
  setLocale: (locale: SupportedLocale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
});

/**
 * Applies a locale to every consumer outside React state: i18next (drives `t()` and
 * `useTranslation()` re-renders), `utils/locale.ts` (drives every `utils/formatters.ts`
 * date/time/number formatter), and the document's `lang`/`dir` on web. Shared by the initial
 * resolution effect and the switcher's `setLocale`, so the two paths can't drift apart.
 */
function applyLocale(locale: SupportedLocale): void {
  i18n.changeLanguage(locale);
  setActiveLocale(locale);

  /* istanbul ignore else -- native has no `document`; every test runs under jsdom */
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
    document.documentElement.dir = LOCALE_DIRECTIONS[locale];
  }
}

/**
 * Mounted under `BrandProvider`, since resolution reads `brand.defaultLocale`. Applies the
 * resolved locale to both i18next (`i18n.changeLanguage`) and `utils/locale.ts`
 * (`setActiveLocale`) — the second call is what makes every date/time/number formatter in
 * `utils/formatters.ts` follow the UI language instead of the device's.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const brand = useBrand();
  const [locale, setLocaleState] = useState<SupportedLocale>(() =>
    resolveLocale(brand.defaultLocale)
  );

  useEffect(() => {
    const resolved = resolveLocale(brand.defaultLocale);
    setLocaleState(resolved);
    applyLocale(resolved);
  }, [brand.defaultLocale]);

  const setLocale = (next: SupportedLocale) => {
    StorageService.setItem(STORAGE_KEY, next);
    setLocaleState(next);
    applyLocale(next);
  };

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
