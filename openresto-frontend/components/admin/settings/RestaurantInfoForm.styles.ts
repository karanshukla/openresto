import { Platform, StyleSheet } from "react-native";
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

  // The form is a run of sibling section cards, not one card with a footer, so the autosave
  // outcome has no corner to sit in. Given its own card it reads as an empty box between edits,
  // since SaveStatus holds its row open on purpose. A bare bar, stuck to the foot of the
  // viewport on web, keeps the outcome and its 10s undo reachable from whichever card was
  // edited rather than parked below the last one.
  statusBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    // Opaque: stuck to the foot of the scrollport it has the rest of the form passing behind it.
    ...(Platform.OS === "web" ? ({ position: "sticky", bottom: 0 } as object) : null),
  },
});
