import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 11,
  },
  // Wide: label and value share a line, matching the admin booking card.
  labelSide: { flexDirection: "row", alignItems: "center", gap: 8, width: 112, flexShrink: 0 },
  label: { fontSize: 13, fontWeight: "600" },
  value: { fontSize: 14, flex: 1, textAlign: "right", lineHeight: 20 },
  // Compact: the value drops under its label, because a right-aligned value on a
  // phone-width sheet wraps an address or a special request into a ragged block.
  compactRow: { gap: 10, alignItems: "flex-start" },
  compactContent: { flex: 1, gap: 2 },
  compactLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase" },
  compactValue: { fontSize: 15, fontWeight: "500", lineHeight: 21 },
  compactIcon: { marginTop: 2 },
  divider: { height: 1 },
});
