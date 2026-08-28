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
  // Wider than settings.styles' 480px `field` because a row carries a description and up to
  // three choices, but still capped: without one the row stretches to the full 1200px card and
  // leaves a resource name stranded a screen away from the control that grants it.
  scopeField: { gap: theme.spacing.xs, width: "100%", maxWidth: 620 },
  scopeGrid: { marginTop: theme.spacing.xxs },
  scopeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
  },
  // minWidth pairs with the row's flexWrap the way settings.styles' fieldFlex does: above it
  // the text column absorbs the slack, below it the choices drop to their own line instead of
  // squeezing against a wrapped description.
  scopeRowText: { flex: 1, minWidth: 160, gap: 1 },
  scopeResourceLabel: { fontSize: 13, fontWeight: "600" },
  scopeResourceHint: { fontSize: 11, lineHeight: 15 },
  scopeToggles: { flexDirection: "row", gap: theme.spacing.xs, flexShrink: 0 },
  scopeChip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
  },
  scopeChipText: { fontSize: 12, fontWeight: "600" },
  expiryChoices: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
});
