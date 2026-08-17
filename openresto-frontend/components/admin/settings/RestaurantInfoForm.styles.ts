import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  field: { gap: theme.spacing.xxs },
  fieldHint: { fontSize: 11, lineHeight: 15 },
  descriptionInput: { height: 96, paddingTop: theme.spacing.xsm, paddingBottom: theme.spacing.xsm },

  menuLabelRow: { flexDirection: "row", alignItems: "baseline", gap: theme.spacing.sm },
  menuFileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xsm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
  },
  menuFileName: { fontSize: 13, flex: 1 },
  menuActions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "center",
    flexWrap: "wrap",
  },
  menuMsg: { fontSize: 12 },

  fieldGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  // maxWidth is what stops the last field of a wrapped row from stretching across the whole
  // card on its own; flexBasis keeps the columns an even width above that.
  gridField: { flexGrow: 1, flexBasis: 240, minWidth: 220, maxWidth: 420, gap: theme.spacing.xxs },
  // Pulled back up under the two-column contact row, which already carries its own gap.
  contactHint: { fontSize: 11, lineHeight: 15, marginTop: -8 },

  footer: {
    padding: theme.spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing.md,
  },
});
