import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

/**
 * Wide enough for the longest option label the filters carry ("All activity", a location
 * name) and narrow enough that three of them still fit a tablet. `flexGrow` off this basis is
 * what drops the row to two lines and then one as the viewport narrows, with no breakpoint.
 */
const FILTER_BASIS = 210;

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

  filtersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  filterControl: {
    flexGrow: 1,
    flexBasis: FILTER_BASIS,
    minWidth: 160,
    maxWidth: 320,
  },

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
