import { Platform, StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  field: { gap: theme.spacing.xxs },
  fieldHint: { fontSize: 12, lineHeight: 16 },
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

  // The booking settings are a few titled groups of fields rather than one wrapped run: the
  // groups are what give nine near-identical dropdowns and number fields any hierarchy.
  fieldGroup: { gap: theme.spacing.xsm },
  fieldGroupDivided: {
    borderTopWidth: 1,
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.lg,
  },
  fieldGroupHeader: { gap: 2 },
  fieldGroupTitle: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  // Capped at two columns (2 × gridField.maxWidth + the gap): a wide admin window used to lay
  // the fields four across, each with a hint wrapped under it, which read as a wall of text.
  // flexBasis is what stops a third column from fitting before the cap is reached.
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, maxWidth: 854 },
  // maxWidth is what stops the last field of a wrapped row from stretching across the whole
  // grid on its own; flexBasis keeps the columns an even width above that.
  gridField: { flexGrow: 1, flexBasis: 300, minWidth: 220, maxWidth: 420, gap: theme.spacing.xxs },
  fieldWarning: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.xxs },
  fieldWarningText: { flex: 1 },

  // Pulled back up under the two-column contact row, which already carries its own gap.
  contactHint: { fontSize: 12, lineHeight: 16, marginTop: -8 },

  // The form is a run of sibling section cards, not one card with a footer, so the autosave
  // outcome has no corner to sit in. Given its own card it reads as an empty box between edits,
  // since SaveStatus holds its row open on purpose. A bare bar, stuck to the foot of the
  // viewport on web, keeps the outcome and its 10s undo reachable from whichever card was
  // edited rather than parked below the last one.
  /** The online party size floor and ceiling, side by side with a dash between. */
  limitPair: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  // Wraps each Input rather than styling it: `flex: 1` on the TextInput itself sat inside the
  // Input's own column wrapper, which gave it a zero flex basis and collapsed its height.
  limitPairInput: { flex: 1, minWidth: 0 },
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
