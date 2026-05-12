import { StyleSheet } from "react-native";
import { COLORS, BUTTON_SIZES, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from "@/theme/theme";
import { hexToRgba } from "@/utils/colors";

export const bookingDetailStyles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: {
    padding: SPACING.xxl,
    paddingTop: SPACING.xxxl,
    gap: SPACING.lg,
    maxWidth: 1100,
    width: "100%",
    alignSelf: "center",
  },

  // Page header
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  headerLeft: {
    gap: 6,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontSize: 14, fontWeight: "600" },
  pageTitle: { ...TYPOGRAPHY.h1 },

  // Two-column layout
  twoCol: {
    flexDirection: "row",
    gap: SPACING.lg,
    alignItems: "flex-start",
  },
  colLeft: { flex: 1 },
  colRight: { flex: 1 },

  // Details card
  card: {
    borderRadius: BORDER_RADIUS.card,
    borderWidth: 1,
    overflow: "hidden",
    ...SHADOWS.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: SPACING.lg,
    paddingVertical: 13,
    gap: SPACING.lg,
  },
  rowLabel: { fontSize: 13, fontWeight: "500", width: 100 },
  rowValue: { fontSize: 14, flex: 1, textAlign: "right" },
  divider: { height: 1 },

  // Edit form / sections
  section: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.card,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 4, marginTop: 8 },
  fieldRow: { flexDirection: "row", gap: SPACING.md },
  fieldHalf: { flex: 1 },

  // Extend buttons
  extendBtns: { flexDirection: "row", gap: SPACING.sm },
  extendBtn: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 10,
    alignItems: "center",
    cursor: "pointer" as const,
  },
  extendBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Email section
  emailTo: { fontSize: 13, marginBottom: 4 },
  emailActions: { flexDirection: "row", alignItems: "center", gap: SPACING.md, flexWrap: "wrap" },
  emailSendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.md,
  },
  emailSendBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  emailResultText: { fontSize: 13, fontWeight: "500" },

  // Header action buttons
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...BUTTON_SIZES.secondary,
    borderRadius: BORDER_RADIUS.md,
  },
  actionBtnText: { ...TYPOGRAPHY.label },

  // Danger zone buttons (bottom of page)
  uncancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...BUTTON_SIZES.secondary,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: hexToRgba(COLORS.success, 0.1),
    cursor: "pointer" as const,
  },
  uncancelBtnText: { color: COLORS.success, fontSize: 14, fontWeight: "700" },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...BUTTON_SIZES.secondary,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: hexToRgba(COLORS.error, 0.1),
    cursor: "pointer" as const,
  },
  cancelBtnText: { color: COLORS.error, fontSize: 14, fontWeight: "700" },
  purgeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...BUTTON_SIZES.secondary,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: 4,
  },
  purgeBtnText: { fontSize: 13, fontWeight: "600" },
});
