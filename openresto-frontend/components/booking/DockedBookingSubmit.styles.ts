import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  /**
   * The rule above it is the only separation from the form scrolling underneath, since the
   * sheet's own background continues behind both. `paddingBottom` is applied by the component
   * instead, because it is the device's own bottom inset.
   */
  dock: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
