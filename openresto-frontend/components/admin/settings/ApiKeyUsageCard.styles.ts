import { Platform, StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

// RN ships no monospace token, and a shell command set in the UI font stops reading as
// something you paste into a terminal — the family is the affordance here, not decoration.
const MONOSPACE = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export const styles = StyleSheet.create({
  intro: { fontSize: 13, lineHeight: 19, maxWidth: 720 },
  // Wrapping, rather than a viewport breakpoint, is what lets the pair sit side by side in the
  // full-width settings column and stack inside anything narrower: minWidth is the point each
  // example stops shrinking and drops to its own line.
  snippetRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.lg },
  snippet: { flex: 1, minWidth: 320, gap: theme.spacing.xxs },
  // The copy control sits on the example's label row rather than inside the block, so the code
  // keeps the full width of a half-column instead of wrapping around a button.
  snippetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 28,
  },
  // flexGrow inside a stretched row is what lines the two captions up: the shorter example's
  // block grows to the taller one's height instead of leaving its caption floating mid-card.
  codeBlock: {
    flexGrow: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
  },
  // Same minWidth:0 as ApiKeySecretModal's secret row: a long unbroken URL is the item's
  // min-content width, and a flex item refuses to shrink past that until it's told to.
  code: { flex: 1, minWidth: 0, fontFamily: MONOSPACE, fontSize: 12, lineHeight: 18 },
  hint: { fontSize: 11, lineHeight: 16 },
  links: { gap: theme.spacing.xs },
});
