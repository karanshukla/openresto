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
  // A translucent band of the page colour behind the button, so the row's own content
  // reads as passing underneath it rather than colliding with it.
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
    borderTopRightRadius: theme.borderRadius.xl,
    borderBottomRightRadius: theme.borderRadius.xl,
  },
  affordanceEnd: {
    right: 0,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderBottomLeftRadius: theme.borderRadius.xl,
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
