import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const bookingDetailStyles = StyleSheet.create({
  twoCol: {
    flexDirection: "row",
    gap: theme.spacing.lg,
    alignItems: "flex-start",
  },
  colLeft: { flex: 1 },
  colRight: { flex: 1 },

  card: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    overflow: "hidden",
    ...theme.shadows.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 13,
    gap: theme.spacing.lg,
  },
  rowLabel: { fontSize: 13, fontWeight: "500", width: 100 },
  rowValue: { fontSize: 14, flex: 1, textAlign: "right" },
  divider: { height: 1 },

  section: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.card,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 4, marginTop: 8 },
  fieldRow: { flexDirection: "row", gap: theme.spacing.md },
  fieldHalf: { flex: 1 },

  extendBtns: { flexDirection: "row", gap: theme.spacing.sm },
  extendBtn: { flex: 1 },

  emailTo: { fontSize: 13, marginBottom: 4 },
  emailActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    flexWrap: "wrap",
  },
  emailResultText: { fontSize: 13, fontWeight: "500" },
});
