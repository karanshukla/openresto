import { StyleSheet } from "react-native";

export const COLORS = {
  primary: "#0a7ea4",
  primaryDark: "#085f7a",
  primaryLight: "#0c96c4",

  success: "#16a34a",
  error: "#dc2626",
  warning: "#f59e0b",
  info: "#3b82f6",

  text: {
    light: "#000000",
    dark: "#ffffff",
  },

  muted: {
    light: "#4b5563", // Increased contrast from #6b7280 for WCAG AA
    dark: "#9ca3af",
  },

  surface: {
    light: "#ffffff",
    dark: "#1e2022",
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
    light: "rgba(0,0,0,0.08)",
    dark: "rgba(255,255,255,0.1)",
  },

  overlay: {
    light: "rgba(0,0,0,0.5)",
    dark: "rgba(0,0,0,0.7)",
  },

  disabled: {
    light: "#d1d5db",
    dark: "#2a2d31",
  },
};

// Status badge colors for booking statuses
export const STATUS_COLORS = {
  arrived: {
    bg: { light: "#dcfce7", dark: "#14532d22" },
    text: "#15803d",
  },
  seated: {
    bg: { light: "rgba(10,126,164,0.1)", dark: "rgba(10,126,164,0.15)" },
    text: COLORS.primary,
  },
  upcoming: {
    bg: { light: "#fef9c3", dark: "#854d0e22" },
    text: "#854d0e",
  },
  scheduled: {
    bg: { light: "#f1f5f9", dark: "#1e2934" },
    text: "#475569", // Increased contrast from #64748b
  },
  completed: {
    bg: { light: "#f1f5f9", dark: "#1a1c1e" },
    text: "#475569", // Increased contrast from #94a3b8
  },
  cancelled: {
    bg: { light: "rgba(220,38,38,0.1)", dark: "rgba(220,38,38,0.15)" },
    text: COLORS.error,
  },
  past: {
    bg: { light: "#f1f5f9", dark: "#1a1c1e" },
    text: { light: "#475569", dark: "#94a3b8" }, // Increased contrast for light mode
  },
};

// Badge colors for location status
export const BADGE_COLORS = {
  active: {
    bg: "#dcfce7",
    text: "#15803d",
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const BUTTON_SIZES = {
  // Primary button (full-width, prominent)
  primary: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    minHeight: 48,
  },
  // Secondary button (medium, inline)
  secondary: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  // Small button (compact, inline)
  small: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    minHeight: 36,
  },
  // Icon button (square, minimal padding)
  icon: {
    padding: 10,
    minHeight: 44,
    minWidth: 44,
  },
};

export const BORDER_RADIUS = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  card: 14,
  full: 9999,
};

export const TYPOGRAPHY = {
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
};

export const SHADOWS = {
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
};

export const getThemeColors = (isDark: boolean) => ({
  text: isDark ? COLORS.text.dark : COLORS.text.light,
  muted: isDark ? COLORS.muted.dark : COLORS.muted.light,
  surface: isDark ? COLORS.surface.dark : COLORS.surface.light,
  page: isDark ? COLORS.page.dark : COLORS.page.light,
  card: isDark ? COLORS.card.dark : COLORS.card.light,
  input: isDark ? COLORS.input.dark : COLORS.input.light,
  border: isDark ? COLORS.border.dark : COLORS.border.light,
  overlay: isDark ? COLORS.overlay.dark : COLORS.overlay.light,
});

export const commonStyles = StyleSheet.create({
  flexCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  flexRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  flexRowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  flexRowStart: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  flexColumn: {
    flexDirection: "column",
  },
  gap: {
    gap: SPACING.md,
  },
  paddingH: {
    paddingHorizontal: SPACING.lg,
  },
  paddingV: {
    paddingVertical: SPACING.lg,
  },
  padding: {
    padding: SPACING.lg,
  },
  marginH: {
    marginHorizontal: SPACING.lg,
  },
  marginV: {
    marginVertical: SPACING.lg,
  },
  margin: {
    margin: SPACING.lg,
  },
});
