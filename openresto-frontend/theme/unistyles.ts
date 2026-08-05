/**
 * Unistyles spike (issue #219) — adapter that exposes the existing design
 * tokens from `theme/theme.ts` as two Unistyles themes.
 *
 * Deliberately NOT a token redesign: `theme.ts` stays the single source of
 * truth and this file only reshapes it into the light/dark pair Unistyles
 * wants, so the spike measures the styling *mechanism* and nothing else.
 */
import { Platform } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { getThemeColors, theme } from "@/theme/theme";

/**
 * `theme.ts` is declared `as const`, so every colour is a string *literal*
 * type. Unistyles' `updateTheme` (used to inject the runtime brand colour)
 * assigns arbitrary strings, so the token types have to be widened first.
 */
const widen = <T extends Record<string, string>>(tokens: T): Record<keyof T, string> => tokens;

function pick(pair: { light: string; dark: string }, isDark: boolean): string {
  return isDark ? pair.dark : pair.light;
}

const makeColors = (isDark: boolean) =>
  widen({
    ...getThemeColors(isDark),
    primary: theme.colors.primary,
    primaryDark: theme.colors.primaryDark,
    primaryLight: theme.colors.primaryLight,
    white: theme.colors.white,
    black: theme.colors.black,
  });

const makeStatusColors = (isDark: boolean) => ({
  arrived: widen({ bg: pick(theme.status.arrived.bg, isDark), text: theme.status.arrived.text }),
  seated: widen({ bg: pick(theme.status.seated.bg, isDark), text: theme.status.seated.text }),
  upcoming: widen({ bg: pick(theme.status.upcoming.bg, isDark), text: theme.status.upcoming.text }),
  scheduled: widen({
    bg: pick(theme.status.scheduled.bg, isDark),
    text: theme.status.scheduled.text,
  }),
  completed: widen({
    bg: pick(theme.status.completed.bg, isDark),
    text: theme.status.completed.text,
  }),
  cancelled: widen({
    bg: pick(theme.status.cancelled.bg, isDark),
    text: theme.status.cancelled.text,
  }),
  past: widen({
    bg: pick(theme.status.past.bg, isDark),
    text: pick(theme.status.past.text, isDark),
  }),
});

const sharedTokens = {
  spacing: theme.spacing,
  borderRadius: theme.borderRadius,
  typography: theme.typography,
  shadows: theme.shadows,
  buttonSizes: theme.buttonSizes,
  formSizes: theme.formSizes,
};

const buildTheme = (isDark: boolean) => ({
  ...sharedTokens,
  isDark,
  colors: makeColors(isDark),
  status: makeStatusColors(isDark),
});

export const lightTheme = buildTheme(false);
export const darkTheme = buildTheme(true);

export const appThemes = {
  light: lightTheme,
  dark: darkTheme,
};

/**
 * Mirrors the breakpoints the app already hand-rolls with `useWindowDimensions`
 * width checks; kept identical so a full migration is a swap, not a re-tune.
 */
export const breakpoints = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
};

export type AppThemes = typeof appThemes;
export type AppBreakpoints = typeof breakpoints;

declare module "react-native-unistyles" {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

const THEME_STORAGE_KEY = "openresto-theme";

/**
 * Resolves the same scheme `context/ThemeContext` resolves, but synchronously
 * at module load — Unistyles is configured before React mounts, so it can't
 * read the context. Duplication is intentional for the spike; a full migration
 * would delete ThemeContext and make UnistylesRuntime the only source.
 */
export function resolveInitialTheme(): keyof AppThemes {
  if (Platform.OS !== "web" || typeof window === "undefined") return "dark";

  try {
    const saved = window.localStorage?.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Private-mode Safari throws on localStorage access; fall through to system.
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

StyleSheet.configure({
  themes: appThemes,
  breakpoints,
  settings: {
    // Adaptive themes are off on purpose: the app supports an explicit
    // light/dark/system *preference*, and `UnistylesRuntime.setTheme` throws
    // while adaptive themes are enabled.
    initialTheme: resolveInitialTheme,
    CSSVars: true,
  },
});
