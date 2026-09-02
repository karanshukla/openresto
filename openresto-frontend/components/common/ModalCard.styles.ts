import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay.light,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xxl,
  },
  card: {
    borderRadius: theme.borderRadius.modal,
    borderWidth: 1,
    padding: theme.spacing.xxl,
    width: "100%",
    maxWidth: 400,
    // Without a ceiling the card is as tall as whatever it holds, so a long dialog stops
    // reading as a dialog and becomes the screen — and its last rows, the buttons included,
    // sit past the bottom edge with no way to reach them. The body scrolls instead.
    maxHeight: "85%",
    gap: theme.spacing.md,
    ...theme.shadows.popup,
  },
  // `flexShrink` is what lets the ceiling above win: a ScrollView sized to its content would
  // push the card taller rather than scrolling inside it.
  body: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyContent: {
    gap: theme.spacing.md,
  },
});
