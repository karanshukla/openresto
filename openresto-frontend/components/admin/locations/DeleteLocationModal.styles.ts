import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  lead: { fontSize: 14, lineHeight: 20 },
  impact: {
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
  },
  impactRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  impactText: { fontSize: 13, flex: 1 },
  impactEmpty: { fontSize: 13, fontStyle: "italic" },
  confirmLabel: { fontSize: 12, fontWeight: "500" },
  error: { fontSize: 12 },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.xsm,
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
  },
  action: { flex: 1, borderRadius: theme.borderRadius.lg },
});
