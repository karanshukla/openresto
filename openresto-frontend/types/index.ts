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
}
