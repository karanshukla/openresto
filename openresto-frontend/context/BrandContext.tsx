import { createContext, useContext, useEffect, useState } from "react";
import LoadingScreen from "@/components/common/LoadingScreen";
import { Brand } from "@/types";
import { buildUrl } from "@/api/client";
import { DEFAULT_BRAND } from "@/context/brandDefaults";
import { useBrandDocumentEffect } from "@/hooks/useBrandDocumentEffect";

const BrandContext = createContext<Brand>(DEFAULT_BRAND);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<Brand>(DEFAULT_BRAND);
  const [loading, setLoading] = useState(process.env.NODE_ENV !== "test");

  // DOM side-effects (document.title + favicon + theme-color + SW patch) are
  // a pure function of `brand` — extracted so the fetch below owns only data.
  useBrandDocumentEffect(brand);

  useEffect(() => {
    fetch(buildUrl("/brand"))
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
            copyrightText: data.copyrightText || undefined,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <BrandContext.Provider value={brand}>
      {/* istanbul ignore next */ loading ? <LoadingScreen brand={brand} /> : children}
    </BrandContext.Provider>
  );
}

export function useBrand(): Brand {
  return useContext(BrandContext);
}
