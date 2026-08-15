import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  selectTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
  },
  selectTileLocked: { opacity: 0.45 },
  seatsRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, marginTop: 2 },
  seatsText: { fontSize: 12 },
  groupChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  groupChipSelect: { marginLeft: theme.spacing.xxs, paddingHorizontal: theme.spacing.sm },
  // The default row's chip carries an unlink button, so it hugs the right edge tighter.
  groupChipRow: { marginLeft: theme.spacing.xs, paddingLeft: theme.spacing.sm, paddingRight: 2 },
  groupChipText: { fontSize: 11, fontWeight: "600" },
  unlinkBtn: { padding: 2 },
  confirmTile: {
    padding: theme.spacing.md,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.xsm,
  },
  rowSeatsRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xxs, marginTop: 2 },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  editCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.xsm,
  },
  editHeading: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  editFields: { flexDirection: "row", gap: theme.spacing.xsm },
  editNameField: { flex: 2, gap: theme.spacing.xs },
  editSeatsField: { flex: 1, gap: theme.spacing.xs },
  editFieldLabel: { fontSize: 11, fontWeight: "600" },
  editActions: { marginTop: theme.spacing.xs },
});
