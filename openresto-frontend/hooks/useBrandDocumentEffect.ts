import { useEffect } from "react";
import { Brand } from "@/types";
import { injectBrandFavicon } from "@/utils/injectBrandFavicon";
import { DEFAULT_BRAND } from "@/context/brandDefaults";

/**
 * Applies the DOM side-effects of a resolved brand: document title + favicon +
 * theme-color meta + SW manifest patch. Pure function of `brand` — no fetch,
 * no state. Extracted from BrandProvider (Bundle 10) so data fetching and DOM
 * mutation are independently testable.
 *
 * Fires on mount and whenever the brand-identity fields that affect the DOM
 * change (appName feeds the title; primaryColor + faviconIcon feed the favicon
 * / theme-color). Non-DOM fields (websiteUrl, copyrightText, …) deliberately
 * omitted from the deps so they don't trigger a re-inject.
 */
export function useBrandDocumentEffect(brand: Brand): void {
  const { appName, primaryColor, faviconIcon } = brand;

  useEffect(() => {
    /* istanbul ignore next */
    if (typeof document === "undefined") return;

    // Only claim the tab title if it is still the default or unset. Once the
    // app's per-route title logic (app/_layout.tsx + app/admin/_layout.tsx) has
    // stamped a "Page | App" title, we must not clobber it on a re-render.
    if (!document.title || document.title === DEFAULT_BRAND.appName) {
      document.title = appName;
    }

    injectBrandFavicon(brand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appName, primaryColor, faviconIcon]);
}
