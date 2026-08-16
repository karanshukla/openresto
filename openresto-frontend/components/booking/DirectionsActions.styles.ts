import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  compactWrap: { padding: 16, gap: 10 },
  compactTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  compactRow: { flexDirection: "row", gap: 8 },
  wideWrap: { padding: theme.spacing.lg, gap: theme.spacing.xsm },
  wideTitle: {
    ...theme.typography.labelSmall,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  wideRow: { flexDirection: "row", gap: 8 },
  wideBtn: { flex: 1 },
});
