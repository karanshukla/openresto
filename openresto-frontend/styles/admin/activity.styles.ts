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

  pageHeader: { gap: 4 },
  pageSub: { ...theme.typography.body },

  filtersSection: { gap: 8 },
  pillRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  pillText: { fontSize: 13, fontWeight: "600" },

  listCard: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    overflow: "hidden",
    ...theme.shadows.sm,
  },

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

  loadMoreBtn: { borderTopWidth: 1, borderRadius: 0 },
});
