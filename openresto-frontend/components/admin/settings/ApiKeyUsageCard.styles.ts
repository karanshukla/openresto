import { Platform, StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

// RN ships no monospace token, and a shell command set in the UI font stops reading as
// something you paste into a terminal — the family is the affordance here, not decoration.
const MONOSPACE = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export const styles = StyleSheet.create({
  block: { gap: theme.spacing.xxs, width: "100%", maxWidth: 620 },
  body: { fontSize: 13, lineHeight: 19 },
  hint: { fontSize: 11, lineHeight: 16 },
  codeBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    marginTop: theme.spacing.xxs,
  },
  // Same minWidth:0 as ApiKeySecretModal's secret row: a long unbroken URL is the item's
  // min-content width, and a flex item refuses to shrink past that until it's told to.
  code: { flex: 1, minWidth: 0, fontFamily: MONOSPACE, fontSize: 12, lineHeight: 18 },
});
