import { Platform, StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

// The family is the affordance: a command set in the UI font stops reading as something you
// paste into a terminal. Same reasoning as ApiKeyUsageCard.
const MONOSPACE = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export const styles = StyleSheet.create({
  body: { gap: theme.spacing.md },
  intro: { fontSize: 13, lineHeight: 19, maxWidth: 720 },
  // The copy control sits on the label row rather than inside the block, so a long command
  // keeps the card's full width instead of wrapping around a button.
  commandHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 28,
    gap: theme.spacing.sm,
  },
  commandBlock: { padding: theme.spacing.md, borderRadius: theme.borderRadius.lg, borderWidth: 1 },
  command: { fontFamily: MONOSPACE, fontSize: 12, lineHeight: 18 },
  hint: { fontSize: 11, lineHeight: 16 },
  links: { gap: theme.spacing.xs },
});
