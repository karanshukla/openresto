/**
 * Design tokens for the OpenResto frontend.
 *
 * Canonical export is the single `theme` object (camelCase API):
 *   import { theme } from "@/theme/theme";
 *   theme.colors.primary, theme.spacing.md, theme.typography.h1, ...
 */
export const theme = {
  colors: {
    primary: "#0a7ea4",
    primaryDark: "#085f7a",
    primaryLight: "#0c96c4",

    success: "#16a34a",
    error: "#dc2626",
    warning: "#f59e0b",
    info: "#3b82f6",

    white: "#ffffff",
    black: "#000000",

    text: {
      light: "#000000",
      dark: "#ffffff",
    },

    muted: {
      light: "#4b5563",
      dark: "#9ca3af",
    },

    surface: {
      light: "#ffffff",
      dark: "#1e2022",
    },

    // The recessed control surface a card sits its own controls on: time chips, map
    // links, icon buttons, and the surface a plain-text action takes while hovered.
    // Distinct from `input`, which is a field's fill. Cool, like `page` and `border`.
    surfaceAlt: {
      light: "#eef0f3",
      dark: "#1b1e23",
    },

    page: {
      light: "#f2f3f5",
      dark: "#111214",
    },

    card: {
      light: "#ffffff",
      dark: "#1e2022",
    },

    input: {
      light: "#f9fafb",
      dark: "#1e2022",
    },

    border: {
      light: "rgba(0,0,0,0.12)",
      dark: "rgba(255,255,255,0.16)",
    },

    // Opaque, and a step up in contrast from `border`: what a card outlines itself with
    // once it is expanded or otherwise the one the diner is acting on.
    borderStrong: {
      light: "#c9cfd8",
      dark: "#383d47",
    },

    overlay: {
      light: "rgba(0,0,0,0.5)",
      dark: "rgba(0,0,0,0.7)",
    },

    disabled: {
      light: "#d1d5db",
      dark: "#2a2d31",
    },
  },

  status: {
    arrived: {
      bg: { light: "#dcfce7", dark: "#14532d22" },
      text: "#15803d",
    },
    seated: {
      bg: { light: "rgba(10,126,164,0.1)", dark: "rgba(10,126,164,0.15)" },
      text: "#0a7ea4",
    },
    upcoming: {
      bg: { light: "#fef9c3", dark: "#854d0e22" },
      text: "#854d0e",
    },
    scheduled: {
      bg: { light: "#f1f5f9", dark: "#1e2934" },
      text: "#475569",
    },
    completed: {
      bg: { light: "#f1f5f9", dark: "#1a1c1e" },
      text: "#475569",
    },
    cancelled: {
      bg: { light: "rgba(220,38,38,0.1)", dark: "rgba(220,38,38,0.15)" },
      text: "#dc2626",
    },
    past: {
      bg: { light: "#f1f5f9", dark: "#1a1c1e" },
      text: { light: "#475569", dark: "#94a3b8" },
    },
  },

  badge: {
    active: {
      bg: "#dcfce7",
      text: "#15803d",
    },
  },

  spacing: {
    xxs: 6,
    xs: 4,
    sm: 8,
    xsm: 10,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  // Button dimensions, keyed by size only — visual treatment is the `variant` axis
  // on <Button>, kept deliberately separate so "large" and "primary" can vary freely.
  buttonSizes: {
    lg: {
      paddingVertical: 14,
      paddingHorizontal: 20,
      minHeight: 48,
    },
    md: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      minHeight: 44,
    },
    sm: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      minHeight: 36,
    },
    icon: {
      padding: 10,
      minHeight: 44,
      minWidth: 44,
    },
  },

  iconSizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
  },

  // WCAG 2.1 AA target sizes. 2.5.5 asks for 44x44; 2.5.8 (AA) sets the floor at 24x24.
  // Visually small controls keep their compact chrome and reach 44 via hitSlop instead.
  a11y: {
    minTouchTarget: 44,
    minTouchTargetCompact: 24,
  },

  borderRadius: {
    xs: 4,
    sm: 6,
    md: 8,
    lg: 10,
    xl: 12,
    card: 14,
    modal: 16,
    full: 9999,
  },

  formSizes: {
    inputHeight: 44,
    inputSmHeight: 36,
    inputBorderRadius: 8,
    inputPaddingH: 12,
    inputFontSize: 15,
  },

  typography: {
    pageTitle: {
      fontSize: 32,
      fontWeight: "800" as const,
      letterSpacing: -0.6,
    },
    h1: {
      fontSize: 26,
      fontWeight: "800" as const,
      lineHeight: 32,
      letterSpacing: -0.5,
    },
    h2: {
      fontSize: 22,
      fontWeight: "700" as const,
      lineHeight: 28,
      letterSpacing: -0.3,
    },
    h3: {
      fontSize: 18,
      fontWeight: "700" as const,
      lineHeight: 24,
    },
    body: {
      fontSize: 15,
      fontWeight: "400" as const,
      lineHeight: 22,
    },
    bodyBold: {
      fontSize: 15,
      fontWeight: "600" as const,
      lineHeight: 22,
    },
    label: {
      fontSize: 13,
      fontWeight: "600" as const,
      lineHeight: 18,
    },
    labelSmall: {
      fontSize: 11,
      fontWeight: "600" as const,
      lineHeight: 16,
      letterSpacing: 0.4,
    },
    caption: {
      fontSize: 12,
      fontWeight: "400" as const,
      lineHeight: 16,
    },
    captionSmall: {
      fontSize: 11,
      fontWeight: "400" as const,
      lineHeight: 14,
    },
  },

  shadows: {
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    md: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    lg: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    popup: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 24,
      elevation: 10,
    },
  },
} as const;

export type ThemeColors = ReturnType<typeof getThemeColors>;

export const getThemeColors = (isDark: boolean) => ({
  text: isDark ? theme.colors.text.dark : theme.colors.text.light,
  muted: isDark ? theme.colors.muted.dark : theme.colors.muted.light,
  surface: isDark ? theme.colors.surface.dark : theme.colors.surface.light,
  surfaceAlt: isDark ? theme.colors.surfaceAlt.dark : theme.colors.surfaceAlt.light,
  page: isDark ? theme.colors.page.dark : theme.colors.page.light,
  card: isDark ? theme.colors.card.dark : theme.colors.card.light,
  input: isDark ? theme.colors.input.dark : theme.colors.input.light,
  border: isDark ? theme.colors.border.dark : theme.colors.border.light,
  borderStrong: isDark ? theme.colors.borderStrong.dark : theme.colors.borderStrong.light,
  overlay: isDark ? theme.colors.overlay.dark : theme.colors.overlay.light,
  disabled: isDark ? theme.colors.disabled.dark : theme.colors.disabled.light,
  success: theme.colors.success,
  error: theme.colors.error,
  warning: theme.colors.warning,
  info: theme.colors.info,
});
