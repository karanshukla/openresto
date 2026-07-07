import { Brand } from "@/types";

/**
 * The brand shown before `/api/brand` resolves (and the fallback for any field
 * the API omits). Shared by BrandProvider, useBrandDocumentEffect, and
 * LoadingScreen so they all agree on the pre-fetch identity.
 */
export const DEFAULT_BRAND: Brand = {
  appName: "Open Resto",
  primaryColor: "#0a7ea4",
};
