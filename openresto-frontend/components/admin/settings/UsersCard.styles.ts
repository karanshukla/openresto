import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  list: { gap: theme.spacing.sm },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, marginTop: 3 },
  badge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  actions: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xxs },
  inactiveRow: { opacity: 0.55 },
  roleChoices: { flexDirection: "row", gap: theme.spacing.xs },
  roleChoice: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
  },
  roleChoiceText: { fontSize: 12, fontWeight: "600" },
  selfNote: { fontSize: 11, marginTop: 2 },
});
