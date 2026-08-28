import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  list: { gap: theme.spacing.sm },
  keyTile: { alignItems: "flex-start" },
  actions: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: 2 },
  metaText: { fontSize: 11 },
  prefix: { fontSize: 12, marginTop: 1 },
  scopeBadges: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xxs, marginTop: 6 },
  badge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  revokedRow: { opacity: 0.6 },
  scopeField: { gap: theme.spacing.xs },
  scopeGrid: { gap: theme.spacing.xs },
  scopeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  scopeResourceLabel: { fontSize: 13, fontWeight: "600", minWidth: 90 },
  scopeToggles: { flexDirection: "row", gap: theme.spacing.xs },
  scopeChip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
  },
  scopeChipText: { fontSize: 12, fontWeight: "600" },
  expiryChoices: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
});
