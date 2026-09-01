import { Platform, StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

// Same reasoning as ApiKeyUsageCard: a URL set in the UI font reads as prose rather than as
// the address the check actually fetched.
const MONOSPACE = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export const styles = StyleSheet.create({
  body: { gap: theme.spacing.lg },
  intro: { gap: theme.spacing.xxs },
  serverUrl: { fontFamily: MONOSPACE, fontSize: 12, lineHeight: 18 },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 17 },
  checks: { gap: theme.spacing.md },
  // The glyph column keeps a fixed width so every label starts on the same vertical line
  // whichever outcome the row carries.
  check: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  checkGlyph: { width: 18, alignItems: "center", marginTop: 1 },
  checkCopy: { flex: 1, gap: 2 },
  checkLabel: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  checkText: { fontSize: 11, lineHeight: 16 },
  loading: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
});
