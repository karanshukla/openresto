declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_URL: string;
  }
}

export interface Brand {
  appName: string;
  primaryColor: string;
  accentColor?: string;
  headerImageUrl?: string;
  faviconIcon?: string;
  websiteUrl?: string;
  /** Default contact phone, used when a location has none of its own. */
  phoneNumber?: string;
  /** Default contact email, used when a location has none of its own. */
  emailAddress?: string;
  copyrightText?: string;
  /** Tagline shown under the app name on the home page hero. */
  subtitle?: string;
  /** Heading above the highlights section (falls back to "Restaurant highlights"). */
  highlightsHeading?: string;
  /** Subheading above the highlights section (falls back to "Curated by the owner"). */
  highlightsSubheading?: string;
  /** How the hero image is fit: "Cover" (default) or "Contain". */
  headerImageFit?: string;
  /**
   * The self-hoster's configured UI language (`Locale:Default` / `OPENRESTO_DEFAULT_LOCALE`),
   * one of `constants/locales.ts`'s `SUPPORTED_LOCALES`. Always populated by the API —
   * `BrandService.GetDefaultLocale` falls back to `"en"` server-side — but optional here to
   * match every other field this type mirrors from `/api/brand`: `DEFAULT_BRAND` (and a mock
   * `Brand` fixture that predates this field) still needs to type-check without it.
   */
  defaultLocale?: string;
}
