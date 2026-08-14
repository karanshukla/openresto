import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 18,
  },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: "600", letterSpacing: -0.2, marginBottom: 4 },
  headerSub: { fontSize: 13 },

  body: { gap: 14 },
  field: { gap: theme.spacing.xxs },
  fieldHint: { fontSize: 11 },
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
  gridField: { flex: 1, minWidth: 220, gap: theme.spacing.xxs },
  contactError: { fontSize: 12, color: theme.colors.error },
  // Pulled back up under the two-column contact row, which already carries its own gap.
  contactHint: { fontSize: 11, marginTop: -8 },

  divider: { marginTop: theme.spacing.xl, borderTopWidth: 1, borderStyle: "dashed" },

  footer: {
    paddingTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  // Why the autosave is paused, shown where the save status otherwise sits.
  blockedRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xxs },
  blockedText: { fontSize: 12 },
});
