import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";
import { hexToRgba } from "@/utils/colors";

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
  extendBtn: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 10,
    alignItems: "center",
    cursor: "pointer" as const,
  },
  extendBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  emailTo: { fontSize: 13, marginBottom: 4 },
  emailActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    flexWrap: "wrap",
  },
  emailSendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
  },
  emailSendBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  emailResultText: { fontSize: 13, fontWeight: "500" },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...theme.buttonSizes.md,
    borderRadius: theme.borderRadius.md,
  },
  actionBtnText: { ...theme.typography.label },

  uncancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...theme.buttonSizes.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: hexToRgba(theme.colors.success, 0.1),
    cursor: "pointer" as const,
  },
  uncancelBtnText: { color: theme.colors.success, fontSize: 14, fontWeight: "700" },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...theme.buttonSizes.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: hexToRgba(theme.colors.error, 0.1),
    cursor: "pointer" as const,
  },
  cancelBtnText: { color: theme.colors.error, fontSize: 14, fontWeight: "700" },
  purgeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...theme.buttonSizes.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    marginTop: 4,
  },
  purgeBtnText: { fontSize: 13, fontWeight: "600" },
});
