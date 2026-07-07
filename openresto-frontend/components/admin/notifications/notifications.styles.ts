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

  // ── Header
  pageHeader: { gap: 4 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  pageTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pageSub: { ...theme.typography.body },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    marginTop: 2,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
    lineHeight: 14,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    minHeight: 44,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // ── Push banner
  pushBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    flexWrap: "wrap",
  },
  pushBannerText: { fontSize: 13, flex: 1, lineHeight: 18 },
  pushBannerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md,
    minWidth: 68,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  pushBannerBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },

  // ── Filters
  filtersSection: { gap: 8 },
  pillRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  pillRow2: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  pillText: { fontSize: 13, fontWeight: "600" },
  unreadDot: { width: 6, height: 6, borderRadius: 3 },

  // ── List card
  listCard: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  sectionDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: theme.spacing.lg,
    paddingVertical: 13,
    gap: 10,
  },
  accentBar: {
    width: 3,
    alignSelf: "stretch",
    borderRadius: 2,
    minHeight: 40,
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  notifBody: { flex: 1, gap: 2 },
  notifTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  notifType: { fontSize: 13, fontWeight: "700" },
  notifRef: { fontSize: 12 },
  unreadPip: { width: 6, height: 6, borderRadius: 3 },
  notifName: { fontSize: 14, fontWeight: "500", lineHeight: 20 },
  notifMeta: { fontSize: 12, lineHeight: 17 },

  // ── Per-row actions
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionPinBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 30,
    minWidth: 52,
  },
  actionToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 30,
    width: 106,
  },
  actionDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: theme.borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  swipeDeleteBg: {
    backgroundColor: theme.colors.error,
    width: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  toast: {
    position: "absolute",
    bottom: 28,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.82)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toastText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600" as const,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // ── Empty / error states
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 72,
    gap: theme.spacing.md,
  },
  emptyIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    ...theme.typography.bodyBold,
    fontSize: 16,
    textAlign: "center",
  },
  emptyBody: {
    ...theme.typography.body,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 22,
  },

  // ── Load more
  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  loadMoreText: { fontSize: 13, fontWeight: "500" },
});
