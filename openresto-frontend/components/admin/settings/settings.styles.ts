import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

/**
 * The settings forms drop to a plain DOM `<select>` where the native picker would be worse on
 * web, so those two need style objects StyleSheet can't hold. The theme-dependent half is a
 * function because a DOM node can't read a token the way a themed RN component does.
 */
export const domStyles = {
  select: {
    width: "100%",
    height: 44,
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: theme.borderRadius.md,
    paddingLeft: theme.spacing.md,
    paddingRight: theme.spacing.md,
    fontSize: 14,
    cursor: "pointer",
  },
} as const;

export const themedSelect = (colors: { border: string; input: string; text: string }) => ({
  borderColor: colors.border,
  backgroundColor: colors.input,
  color: colors.text,
});

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
  // The pair of location-wide bulk actions (pause bookings, extend bookings) under the page
  // header: two equal columns rather than a right-aligned cluster, because neither is secondary.
  bulkActions: { flexDirection: "row", gap: theme.spacing.sm },
  bulkAction: { flex: 1 },
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
  addForm: { gap: theme.spacing.sm, paddingTop: theme.spacing.sm },
  sectionBlock: {
    paddingBottom: theme.spacing.md,
  },
  // SettingsPage now renders at the same 1200px width as every other admin page (via
  // `container` below), so a lone field left unbounded would stretch a one-line input
  // across the whole card. Capping it keeps inputs a readable size regardless of container
  // width; fieldRow/fieldFlex below let two related fields (e.g. phone/email) share a row.
  field: { gap: theme.spacing.xs, width: "100%", maxWidth: 480 },
  // minWidth (paired with the row's flexWrap) is what makes a row's two fields drop to
  // stacked full-width columns on a narrow viewport instead of squeezing side by side.
  fieldRow: { flexDirection: "row", gap: theme.spacing.md, flexWrap: "wrap" },
  fieldFlex: { flex: 1, minWidth: 220 },
  // Shared form-field label style used across every settings card. Inline copies in
  // RestaurantInfoForm / HighlightsCard should migrate to this token (see #231).
  fieldLabel: { fontSize: 12, fontWeight: "500" as const },
  // A field label paired with a trailing counter or badge.
  fieldHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fieldCharCount: { fontSize: 11 },
  fieldHint: { fontSize: 11, marginTop: theme.spacing.xs },
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
  // The title/subtitle column between a section's icon and its trailing chevron or control.
  secHeaderCopy: { flex: 1 },
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
  // The title/subtitle column of a row, next to its trailing action button.
  secRowCopy: { flex: 1 },
  // Spacing above a <ButtonRow> that closes an expanded row form.
  formActions: { marginTop: theme.spacing.xs },
  // The surface tile that list entries (social links, tables, highlights) all render as:
  // a leading icon square, a title/subtitle column, then a trailing action cluster.
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tileCopy: { flex: 1 },
  tileTitle: { fontSize: 14, fontWeight: "600" },
  tileSub: { fontSize: 12, marginTop: 2 },
  secForm: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    gap: theme.spacing.sm,
  },
  // Chrome shared by the two policy sections of RestaurantInfoForm (opening hours, walk-in
  // policy): an outlined card, a title/subtitle + segmented-mode header, and a day grid.
  policyCard: {
    gap: theme.spacing.md,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    padding: 14,
  },
  policyHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.xsm,
  },
  policyHeaderCopy: { gap: 2 },
  policyTitle: { fontSize: 13, fontWeight: "600" },
  policySub: { fontSize: 11 },
  policyModeGroup: {
    flexDirection: "row",
    gap: 2,
    padding: 3,
    borderRadius: 9,
  },
  policyNote: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xxs },
  policyHint: { fontSize: 11 },
  policyField: { gap: theme.spacing.xxs },
  dayGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  dayBtn: {
    minWidth: 96,
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: theme.spacing.xsm,
    paddingHorizontal: theme.spacing.md,
    alignItems: "center",
  },
  dayBtnLabel: { fontSize: 12, fontWeight: "500" },
  // Dashed placeholder shown where a list (social links, tables) has nothing in it yet.
  emptyState: {
    padding: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.xxs,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    borderStyle: "dashed",
  },
  emptyStateText: { fontSize: 13, textAlign: "center" },
  // Two-step delete: the consequence is stated in place, then confirmed, rather than in a modal.
  confirmCopy: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  confirmIcon: { marginTop: 1 },
  confirmText: { flex: 1, fontSize: 12, lineHeight: 17 },
  confirmTextStrong: { fontWeight: "700" },
  // The inline create/edit form used by the social-link and highlight lists: an icon picker
  // above the text fields, then a <ButtonRow> of Cancel / Save.
  editForm: {
    padding: 14,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.xsm,
  },
  editFormIconField: { gap: theme.spacing.xxs },
  editFormIconGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xxs },
  editFormSwatch: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  editFormField: { gap: theme.spacing.xs },
  editFormError: { marginTop: 2 },
  // A settings card's inline status line — a test result, a save outcome, a footer hint.
  statusText: { ...theme.typography.label },
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
