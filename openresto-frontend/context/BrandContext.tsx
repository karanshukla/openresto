import { createContext, useContext, useEffect, useState } from "react";
import LoadingScreen from "@/components/common/LoadingScreen";
import { Brand } from "@/types";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

function buildEndpoint(path: string): string {
  const base = API_URL?.replace(/\/$/, "") ?? "";
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
            logoUrl: data.logoUrl || undefined,
          };
          setBrand(newBrand);

          if (typeof document !== "undefined") {
            // Update title
            if (!document.title || document.title === DEFAULT_BRAND.appName) {
              document.title = newBrand.appName;
            }

            // Update favicon & apple-touch-icon
            if (newBrand.logoUrl) {
              const links = document.querySelectorAll("link[rel*='icon']");
              links.forEach((link) => {
                (link as HTMLLinkElement).href = newBrand.logoUrl!;
              });

              // Also update apple-touch-icon specifically if it exists
              const appleIcon = document.querySelector("link[rel='apple-touch-icon']");
              if (appleIcon) {
                (appleIcon as HTMLLinkElement).href = newBrand.logoUrl!;
              } else {
                const newAppleIcon = document.createElement("link");
                newAppleIcon.rel = "apple-touch-icon";
                newAppleIcon.href = newBrand.logoUrl!;
                document.head.appendChild(newAppleIcon);
              }
            }
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
      {loading ? <LoadingScreen brand={brand} /> : children}
    </BrandContext.Provider>
  );
}

export function useBrand(): Brand {
  return useContext(BrandContext);
}
