declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_URL: string;
  }
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  tiktok?: string;
  youtube?: string;
}

export interface Brand {
  appName: string;
  primaryColor: string;
  accentColor?: string;
  headerImageUrl?: string;
  faviconIcon?: string;
  websiteUrl?: string;
  copyrightText?: string;
  socialLinks?: SocialLinks;
}
