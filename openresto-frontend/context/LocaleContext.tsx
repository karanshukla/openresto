import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getLocales } from "expo-localization";
import i18n from "@/i18n";
import { setActiveLocale } from "@/utils/locale";
import { StorageService } from "@/services/storage";
import { useBrand } from "@/context/BrandContext";
import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from "@/constants/locales";

const STORAGE_KEY = "openresto.locale";

/**
 * Resolution order, highest priority first:
 *  1. The viewer's own pick, in `localStorage["openresto.locale"]` — nothing writes this key
 *     yet, the switcher that does ships in #373; this layer exists so it activates the moment
 *     that lands, with no further wiring here.
 *  2. `brand.defaultLocale`, the self-hoster's `Locale:Default` / `OPENRESTO_DEFAULT_LOCALE`.
 *  3. `DEFAULT_LOCALE` ("en"), hardcoded.
 *
 * Device locale is deliberately not in this chain — a restaurant that sets `fr` wants `fr`
 * for everyone, and the switcher is the escape hatch for the tourist.
 */
function resolveLocale(brandDefaultLocale: string | undefined): SupportedLocale {
  const stored = StorageService.getItem(STORAGE_KEY);
  if (isSupportedLocale(stored)) return stored;
  if (isSupportedLocale(brandDefaultLocale)) return brandDefaultLocale;
  return DEFAULT_LOCALE;
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
    document.documentElement.dir = getLocales()[0]?.textDirection ?? "ltr";
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
