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
  copyrightText?: string;
  /** Tagline shown under the app name on the home page hero. */
  subtitle?: string;
  /** Heading above the highlights section (falls back to "Restaurant highlights"). */
  highlightsHeading?: string;
  /** Subheading above the highlights section (falls back to "Curated by the owner"). */
  highlightsSubheading?: string;
  /** How the hero image is fit: "Cover" (default) or "Contain". */
  headerImageFit?: string;
}
