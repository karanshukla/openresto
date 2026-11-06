import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

/** Wide enough for two 44px actions side by side, narrow enough for three across a tablet column. */
export const TILE_MIN_WIDTH = 176;

export const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: TILE_MIN_WIDTH,
    minWidth: TILE_MIN_WIDTH,
    maxWidth: 280,
    minHeight: 148,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderLeftWidth: 5,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  target: { borderWidth: 2, borderLeftWidth: 5 },
  dimmed: { opacity: 0.5 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  name: { ...theme.typography.h3, flexShrink: 1 },
  seats: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
  seatsText: { ...theme.typography.label },
  chipRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: theme.spacing.xs },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  chipText: { ...theme.typography.labelSmall, textTransform: "uppercase" },
  body: { gap: 2, flexGrow: 1 },
  guest: { ...theme.typography.bodyBold },
  detail: { fontSize: 13, lineHeight: 18 },
  emphasis: { fontSize: 14, fontWeight: "700", lineHeight: 20 },
  reason: { flexDirection: "row", alignItems: "center", gap: 6 },
});
