import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

/** Wide enough for the longest row label in all four locales, narrow enough to read as a menu. */
export const MENU_WIDTH = 260;

export const styles = StyleSheet.create({
  trigger: {
    alignSelf: "flex-start",
  },
  panelInner: {
    paddingVertical: theme.spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    // The WCAG 2.5.5 target the admin's controls are held to.
    minHeight: 44,
    paddingHorizontal: theme.spacing.lg,
  },
  rowText: {
    ...theme.typography.body,
  },
  value: {
    marginLeft: "auto",
    ...theme.typography.caption,
  },
});
