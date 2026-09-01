import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  body: { gap: theme.spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  headerRow: { borderBottomWidth: 1, paddingBottom: theme.spacing.xs },
  // The platform cell carries a glyph beside its label, so it is the one column that needs
  // its own row; the rest are plain text sized by flex.
  platformCell: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, flex: 2 },
  cell: { flex: 2 },
  // The two count columns are narrower and right-aligned so figures line up on their units.
  countCell: { flex: 1, textAlign: "right" },
  headerText: { fontSize: 11, fontWeight: "600", lineHeight: 16 },
  cellText: { fontSize: 13, lineHeight: 18 },
  loading: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  loadingText: { fontSize: 11, lineHeight: 16 },
});
