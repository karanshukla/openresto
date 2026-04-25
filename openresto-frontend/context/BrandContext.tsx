import { createContext, useContext, useEffect, useState } from "react";
import LoadingScreen from "@/components/common/LoadingScreen";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

function buildEndpoint(path: string): string {
  const base = API_URL?.replace(/\/$/, "") ?? "";
  if (!base) return `/api${path}`;
  return base.includes("/api") ? `${base}${path}` : `${base}/api${path}`;
}

export interface Brand {
  appName: string;
  primaryColor: string;
  accentColor?: string;
  logoUrl?: string;
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
          setBrand({
            appName: data.appName || DEFAULT_BRAND.appName,
            primaryColor: data.primaryColor || DEFAULT_BRAND.primaryColor,
            accentColor: data.accentColor || undefined,
            logoUrl: data.logoUrl || undefined,
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
      {loading ? <LoadingScreen brand={brand} /> : children}
    </BrandContext.Provider>
  );
}

export function useBrand(): Brand {
  return useContext(BrandContext);
}
