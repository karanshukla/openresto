import { createContext, useContext, useEffect, useState } from "react";
import LoadingScreen from "@/components/common/LoadingScreen";
import { Brand } from "@/types";
import { injectBrandFavicon } from "@/utils/injectBrandFavicon";

function buildEndpoint(path: string): string {
  const base = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  if (!base) return `/api${path}`;
  return base.includes("/api") ? `${base}${path}` : `${base}/api${path}`;
}

const DEFAULT_BRAND: Brand = {
  appName: "Open Resto",
  primaryColor: "#0a7ea4",
};

const BrandContext = createContext<Brand>(DEFAULT_BRAND);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<Brand>(DEFAULT_BRAND);
  const [loading, setLoading] = useState(process.env.NODE_ENV !== "test");

  useEffect(() => {
    fetch(buildEndpoint("/brand"))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          const newBrand = {
            appName: data.appName || DEFAULT_BRAND.appName,
            primaryColor: data.primaryColor || DEFAULT_BRAND.primaryColor,
            accentColor: data.accentColor || undefined,
            headerImageUrl: data.headerImageUrl || undefined,
            faviconIcon: data.faviconIcon || undefined,
            websiteUrl: data.websiteUrl || undefined,
            copyrightText: data.copyrightText || undefined,
          };
          setBrand(newBrand);

          /* istanbul ignore else */
          if (typeof document !== "undefined") {
            if (!document.title || document.title === DEFAULT_BRAND.appName) {
              document.title = newBrand.appName;
            }
            injectBrandFavicon(newBrand);
          }
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
