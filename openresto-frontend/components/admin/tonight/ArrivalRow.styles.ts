import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  row: {
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  selected: { borderLeftWidth: 4 },
  top: { flexDirection: "row", gap: theme.spacing.md },
  when: { width: 76, gap: 2 },
  time: { ...theme.typography.bodyBold, fontSize: 15 },
  relative: { fontSize: 12, fontWeight: "700", lineHeight: 16 },
  main: { flex: 1, gap: theme.spacing.xs },
  nameRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: theme.spacing.xs },
  name: { ...theme.typography.bodyBold, flexShrink: 1 },
  chip: {
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 1,
  },
  chipText: { ...theme.typography.labelSmall, textTransform: "uppercase" },
  meta: { fontSize: 13, lineHeight: 18 },
  note: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
  noteText: { fontSize: 12, lineHeight: 16, flexShrink: 1, fontStyle: "italic" },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
});
