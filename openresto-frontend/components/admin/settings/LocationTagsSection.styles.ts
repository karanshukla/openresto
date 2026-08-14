import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  wrapper: { gap: theme.spacing.xxs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xxs, marginBottom: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderRadius: theme.borderRadius.full,
    paddingLeft: theme.spacing.xsm,
    paddingRight: theme.spacing.xxs,
    paddingVertical: theme.spacing.xs,
  },
  chipText: { fontSize: 12 },
  addRow: { flexDirection: "row", gap: theme.spacing.sm },
  addInput: { flex: 1 },
  hint: { fontSize: 11 },
});
