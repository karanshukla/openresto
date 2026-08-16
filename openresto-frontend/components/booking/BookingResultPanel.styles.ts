import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  stack: { gap: 10, width: "100%" },
  card: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    overflow: "hidden",
    ...theme.shadows.md,
  },
  cardHeader: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  title: { ...theme.typography.h3, flexShrink: 1 },
  refRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexWrap: "wrap" },
  refBadge: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  refText: { ...theme.typography.bodyBold, fontWeight: "700", letterSpacing: 0.3 },
  divider: { height: 1 },
  mapCard: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  mapFrame: {
    width: "100%",
    height: 160,
    borderRadius: theme.borderRadius.md,
  },
  mapAddressRow: { flexDirection: "row", alignItems: "flex-start", gap: 5 },
  mapAddress: { fontSize: 13, flex: 1, lineHeight: 18 },
  cancelCard: { padding: theme.spacing.lg, gap: theme.spacing.sm, alignItems: "center" },
  cancelHint: {
    ...theme.typography.caption,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: theme.spacing.sm,
  },
});
