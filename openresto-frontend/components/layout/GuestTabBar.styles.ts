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
  /** Material 3's selected-destination pill: 64x32 with a fully rounded edge. */
  indicator: {
    width: 64,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
  },
});
