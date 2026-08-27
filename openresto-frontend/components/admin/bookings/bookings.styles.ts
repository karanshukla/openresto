import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
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
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  pageTitle: { ...theme.typography.h1 },
  pageSub: { ...theme.typography.body, marginTop: 2 },
  headerControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  chipText: { ...theme.typography.label },
  chipTextActive: { color: "#fff", fontWeight: "600", fontSize: 13 },
  /**
   * The screen's filter chrome, stacked rather than one wrapping row. A single row put the
   * location chips, a flexible spacer and the toggles together, so where the toggles landed
   * depended on how many chips fit beside them — and on which mode was showing, since the status
   * tabs only exist in list view. Giving each its own row fixes the toggles in place.
   */
  filterBar: { gap: theme.spacing.sm },
  locationChips: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  /** Sits above the list it filters, so it does not stretch to the screen's width. */
  statusTabs: { alignSelf: "flex-start" },
  viewControls: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  modeToggle: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
  },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
  },
  modeBtnText: { ...theme.typography.label },
  spinner: { marginTop: 40 },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: theme.spacing.md },
  emptyStateAction: { marginTop: theme.spacing.sm },
  emptyText: { ...theme.typography.body, fontStyle: "italic" },

  gridCard: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  gridDateBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
  },
  gridNavBtn: { ...theme.buttonSizes.icon },
  gridDateLabel: { alignItems: "center", gap: 2 },
  gridDateText: { ...theme.typography.bodyBold, fontSize: 16 },
  gridTodayHint: { ...theme.typography.captionSmall, fontWeight: "600" },
  gridLegend: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 3 },
  legendText: { ...theme.typography.caption },
  gridHeaderText: { ...theme.typography.labelSmall, letterSpacing: 0.5 },
  gridSectionLabel: { ...theme.typography.labelSmall, letterSpacing: 0.8 },
  gridTableName: { ...theme.typography.caption, fontWeight: "600" },
  gridTableSeats: { fontSize: 10 },
  gridBarGuest: { fontSize: 11, fontWeight: "600" },
  gridBarTime: { fontSize: 9 },

  tableCard: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  thCell: { ...theme.typography.labelSmall, letterSpacing: 0.8 },
  thCellActive: { fontWeight: "700" as const },
  // Horizontal padding/margin are intentionally 0: each header cell's box must
  // be exactly the column width (colTime/colGuest/...) so it lines up with the
  // data cells below it. A marginHorizontal here would shrink the cell's layout
  // footprint and make the flex GUEST column absorb the drift — the header row
  // ends up wider/narrower than the data rows and every column skews. Only the
  // vertical padding/margin are kept; they expand the tap target vertically
  // without affecting column alignment.
  thSortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
    marginVertical: -2,
    borderRadius: theme.borderRadius.sm,
  },
  sortControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  sortControlLabel: { ...theme.typography.caption, fontWeight: "600" as const },
  sortControlChips: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  sortChipText: { ...theme.typography.caption, fontWeight: "600" as const },
  sortChipTextActive: { color: "#fff" },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 14,
  },
  colTime: { width: 140 },
  colGuest: { flex: 1, paddingHorizontal: theme.spacing.sm },
  colParty: { width: 64, alignItems: "flex-start" },
  colTable: { width: 64 },
  colStatus: { width: 108 },
  colAction: { width: 96, flexDirection: "row", alignItems: "center", gap: 6 },
  tdTime: { ...theme.typography.bodyBold, fontSize: 14 },
  tdDate: { ...theme.typography.caption, marginTop: 1 },
  tdGuest: { ...theme.typography.body, fontWeight: "500" },
  tdNotes: { ...theme.typography.caption, marginTop: 1 },
  partyPill: { flexDirection: "row", alignItems: "center", gap: 4 },
  tdParty: { ...theme.typography.label },
  tdTableNum: { ...theme.typography.body, fontSize: 14 },
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    alignSelf: "flex-start",
  },
  badgeText: { ...theme.typography.labelSmall, fontWeight: "700" },

  cardListWrap: { gap: theme.spacing.md },
  cardList: { gap: theme.spacing.md },
  listCard: {
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    padding: 14,
    ...theme.shadows.sm,
  },
  listCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  listCardInfo: { flex: 1, gap: 4 },
  listCardRight: { alignItems: "flex-end" },
});
