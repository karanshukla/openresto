import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

/** The band the control occupies, matching the hero's own reservation for it on the home root. */
export const SETTINGS_ANCHOR_ROW = 40;
/** Its distance from the trailing edge, outside any display cutout. */
export const SETTINGS_ANCHOR_EDGE = 12;
/**
 * What a header-less root's own title keeps clear so the pinned control never lands on its
 * words. Generous by the page column's inset, which only ever adds clearance.
 */
export const SETTINGS_ANCHOR_SLOT = SETTINGS_ANCHOR_ROW + SETTINGS_ANCHOR_EDGE;

export const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    justifyContent: "center",
    height: SETTINGS_ANCHOR_ROW,
    zIndex: 1,
  },
  chip: {
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
  },
});
