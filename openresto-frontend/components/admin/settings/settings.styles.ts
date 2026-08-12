import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: {
    padding: theme.spacing.xxl,
    paddingTop: theme.spacing.xxxl,
    gap: theme.spacing.lg,
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
  },
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  pageSub: {
    ...theme.typography.body,
    marginTop: 2,
  },
  section: { gap: theme.spacing.lg },
  sectionHeading: {
    ...theme.typography.labelSmall,
    letterSpacing: 0.8,
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  secCard: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  editableValue: { ...theme.typography.bodyBold, flex: 1, fontSize: 16 },
  smallBtn: {
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    ...theme.buttonSizes.sm,
  },
  smallBtnText: { ...theme.typography.label, fontWeight: "600" },
  addForm: { gap: theme.spacing.sm, paddingTop: theme.spacing.sm },
  actionBtn: {
    ...theme.buttonSizes.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: { ...theme.typography.label },
  sectionBlock: {
    paddingBottom: theme.spacing.md,
  },
  field: { gap: theme.spacing.xs },
  // Shared form-field label style used across every settings card. Inline copies in
  // RestaurantInfoForm / HighlightsCard should migrate to this token (see #231).
  fieldLabel: { fontSize: 12, fontWeight: "500" as const },
  secHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  secIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  secTitle: { ...theme.typography.bodyBold },
  secSub: { ...theme.typography.caption, marginTop: 1 },
  secRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    borderTopWidth: 1,
    gap: theme.spacing.md,
  },
  secRowTitle: { ...theme.typography.bodyBold },
  secRowSub: { ...theme.typography.caption, marginTop: 1 },
  secBtn: { ...theme.buttonSizes.md, borderWidth: 1, borderRadius: theme.borderRadius.md },
  secBtnText: { ...theme.typography.label },
  secForm: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    gap: theme.spacing.sm,
  },
  errorText: { ...theme.typography.label, color: theme.colors.error },
  successText: { ...theme.typography.label, color: theme.colors.success },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    paddingTop: 0,
  },
});
