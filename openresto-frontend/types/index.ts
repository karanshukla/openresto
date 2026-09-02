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
   * Where the admin's API-keys screen points someone who wants to drive the API themselves:
   * the published CLI package, the raw-HTTP guide, and the source repository. Resolved
   * server-side (`Links:*` / `OPENRESTO_*_URL`) and defaulted to the upstream OpenResto URLs,
   * so a fork redirects them without rebuilding this app — the same reason `defaultLocale`
   * arrives on `/api/brand` rather than an `EXPO_PUBLIC_*` build arg.
   */
  cliPackageUrl?: string;
  /** @see {@link cliPackageUrl} */
  apiDocsUrl?: string;
  /** @see {@link cliPackageUrl} */
  repositoryUrl?: string;
  /**
   * Where the privacy policy lives. A store listing needs one before it can be published, and
   * the guest footer links it when set. Optional in the API response; unset means none.
   */
  privacyPolicyUrl?: string;
  /**
   * The oldest native app version the server still supports (`major.minor.patch`). A native
   * build below it shows an update-required screen instead of the app; web ignores it.
   */
  minimumAppVersion?: string;
  /**
   * Which wallet passes the server can issue. A platform is offered on the booking card only
   * when its issuer is configured server-side; absent means neither.
   */
  wallet?: { apple: boolean; google: boolean };
  /**
   * The VAPID public key a browser subscribes to booking reminders with; unset when the server
   * has no push keys, in which case the web reminder toggle stays hidden.
   */
  webPushPublicKey?: string;
  /**
   * The self-hoster's configured UI language (`Locale:Default` / `OPENRESTO_DEFAULT_LOCALE`),
   * one of `constants/locales.ts`'s `SUPPORTED_LOCALES`. Always populated by the API —
   * `BrandService.GetDefaultLocale` falls back to `"en"` server-side — but optional here to
   * match every other field this type mirrors from `/api/brand`: `DEFAULT_BRAND` (and a mock
   * `Brand` fixture that predates this field) still needs to type-check without it.
   */
  defaultLocale?: string;
}
