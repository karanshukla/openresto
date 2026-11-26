import { createContext, useContext, useEffect, useState } from "react";
import LoadingScreen from "@/components/common/LoadingScreen";
import { Brand } from "@/types";
import { buildUrl } from "@/api/client";
import { fetchHighlights, type HighlightDto } from "@/api/highlights";
import { DEFAULT_BRAND } from "@/context/brandDefaults";
import { useBrandDocumentEffect } from "@/hooks/useBrandDocumentEffect";
import i18n from "@/i18n";
import { resolveLocale } from "@/utils/resolveLocale";

const BrandContext = createContext<Brand>(DEFAULT_BRAND);
const HighlightsContext = createContext<HighlightDto[]>([]);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<Brand>(DEFAULT_BRAND);
  const [highlights, setHighlights] = useState<HighlightDto[]>([]);
  const [loading, setLoading] = useState(process.env.NODE_ENV !== "test");

  // DOM side-effects (document.title + favicon + theme-color + SW patch) are
  // a pure function of `brand` — extracted so the fetch below owns only data.
  useBrandDocumentEffect(brand);

  useEffect(() => {
    const brandLoaded = fetch(buildUrl("/brand"))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setBrand({
            appName: data.appName || DEFAULT_BRAND.appName,
            primaryColor: data.primaryColor || DEFAULT_BRAND.primaryColor,
            accentColor: data.accentColor || undefined,
            headerImageUrl: data.headerImageUrl || undefined,
            faviconIcon: data.faviconIcon || undefined,
            websiteUrl: data.websiteUrl || undefined,
            phoneNumber: data.phoneNumber || undefined,
            emailAddress: data.emailAddress || undefined,
            copyrightText: data.copyrightText || undefined,
            subtitle: data.subtitle || undefined,
            highlightsHeading: data.highlightsHeading || undefined,
            highlightsSubheading: data.highlightsSubheading || undefined,
            headerImageFit: data.headerImageFit || undefined,
            defaultLocale: data.defaultLocale || DEFAULT_BRAND.defaultLocale,
            cliPackageUrl: data.cliPackageUrl || undefined,
            apiDocsUrl: data.apiDocsUrl || undefined,
            repositoryUrl: data.repositoryUrl || undefined,
            privacyPolicyUrl: data.privacyPolicyUrl || undefined,
            minimumAppVersion: data.minimumAppVersion || undefined,
            wallet: data.wallet
              ? { apple: Boolean(data.wallet.apple), google: Boolean(data.wallet.google) }
              : undefined,
            webPushPublicKey: data.webPushPublicKey || undefined,
          });
        }
        return data?.defaultLocale;
      })
      .catch(() => undefined)
      // Fetch the locale LocaleProvider is about to apply while the loading screen is still up, so
      // a non-English visitor never sees the page in English first.
      .then((defaultLocale) => i18n.loadLanguages(resolveLocale(defaultLocale)));
    // Fetched behind the loading screen too: the home page lays out around the highlights, so
    // finding out whether there are any after it renders moves everything below them.
    const highlightsLoaded = fetchHighlights().then(setHighlights);
    Promise.all([brandLoaded, highlightsLoaded]).finally(() => {
      setLoading(false);
    });
  }, []);

  return (
    <BrandContext.Provider value={brand}>
      <HighlightsContext.Provider value={highlights}>
        {/* istanbul ignore next */ loading ? <LoadingScreen brand={brand} /> : children}
      </HighlightsContext.Provider>
    </BrandContext.Provider>
  );
}

export function useBrand(): Brand {
  return useContext(BrandContext);
}

/** The home page's highlights, loaded with the brand. */
export function useHighlights(): HighlightDto[] {
  return useContext(HighlightsContext);
}
