import { Platform } from "react-native";
import { getLocales } from "expo-localization";
import { StorageService } from "@/services/storage";
import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from "@/constants/locales";

export const LOCALE_STORAGE_KEY = "openresto.locale";

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
 *  1. The viewer's own pick, in `localStorage["openresto.locale"]`, written by
 *     `LocaleContext`'s `setLocale` — the admin sidebar's `LanguageSwitcher`, the guest
 *     navbar's overflow menu and the native guest settings sheet all go through it. A value
 *     outside `SUPPORTED_LOCALES` is ignored, not trusted.
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
export function resolveLocale(brandDefaultLocale: string | undefined): SupportedLocale {
  const stored = StorageService.getItem(LOCALE_STORAGE_KEY);
  if (isSupportedLocale(stored)) return stored;
  return (
    deviceLocale() ?? (isSupportedLocale(brandDefaultLocale) ? brandDefaultLocale : DEFAULT_LOCALE)
  );
}
