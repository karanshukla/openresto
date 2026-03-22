/**
 * Business-configurable app name.
 * Set EXPO_PUBLIC_APP_NAME in your .env file when deploying per-business.
 * Falls back to "Open Resto" if not set.
 */
export const APP_NAME =
  process.env.EXPO_PUBLIC_APP_NAME ?? "Open Resto";
