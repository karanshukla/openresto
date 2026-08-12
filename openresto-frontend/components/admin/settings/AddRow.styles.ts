import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  addPillRight: { alignSelf: "flex-end" },
  fields: { flexDirection: "row", gap: theme.spacing.md },
  extraField: { flex: 1 },
  footer: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  cancelBtn: {
    padding: theme.spacing.xxs,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
  },
});
