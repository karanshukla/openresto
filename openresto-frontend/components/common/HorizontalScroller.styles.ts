import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  /**
   * Fills its parent, but yields to a sibling beside it instead of claiming the whole line
   * and pushing that sibling off the page. react-native-web's base View style is
   * `flexShrink: 0`, which would otherwise make the 100% a floor rather than a starting size.
   *
   * @see [admin-notifications-layout.spec.ts](../../e2e/admin-notifications-layout.spec.ts) —
   * pins that the notifications unread toggle stays on the page beside the scrolling row of
   * type filters.
   */
  wrapper: {
    position: "relative",
    width: "100%",
    flexShrink: 1,
    minWidth: 0,
  },
  // Positioning only, and deliberately transparent. This carried a translucent band of the
  // page colour so content read as passing under the button; that is invisible on the page
  // background it was named after, and over anything else — the home hero's image — it is a
  // dark slab across the row. The button's own filled, bordered circle already separates it
  // from whatever scrolls beneath.
  affordance: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 44,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  affordanceStart: {
    left: 0,
  },
  affordanceEnd: {
    right: 0,
  },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
});
