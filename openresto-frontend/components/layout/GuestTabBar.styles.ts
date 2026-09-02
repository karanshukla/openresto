import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

/** Meets the WCAG 2.5.5 target size the admin's buttons are held to. */
const TAB_MIN_HEIGHT = 44;

export const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    minHeight: TAB_MIN_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xxs,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
  },
});
