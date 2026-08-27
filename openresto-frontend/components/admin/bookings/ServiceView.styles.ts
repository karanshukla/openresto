import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

/** Keeps a unit card wide enough for a guest name and a time range on one line. */
export const UNIT_MIN_W = 210;

export const styles = StyleSheet.create({
  scrubBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    flexWrap: "wrap",
  },
  scrubNavBtn: { ...theme.buttonSizes.icon },
  scrubClock: {
    ...theme.typography.bodyBold,
    fontSize: 18,
    fontVariant: ["tabular-nums"],
    minWidth: 72,
    textAlign: "center",
  },
  scrubTrack: {
    flex: 1,
    minWidth: 140,
    height: theme.a11y.minTouchTarget,
    justifyContent: "center",
  },
  scrubRail: { height: 4, borderRadius: theme.borderRadius.full },
  scrubFill: { position: "absolute", left: 0, height: 4, borderRadius: theme.borderRadius.full },
  scrubThumb: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: theme.borderRadius.full,
    borderWidth: 2,
    marginLeft: -8,
  },

  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexWrap: "wrap",
  },
  summaryItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  summaryDot: { width: 10, height: 10, borderRadius: theme.borderRadius.full },
  summaryText: { ...theme.typography.caption },
  summaryCovers: { ...theme.typography.caption, fontWeight: "600" },

  floor: { padding: theme.spacing.lg, gap: theme.spacing.xl },
  section: { gap: theme.spacing.sm },
  sectionLabel: { ...theme.typography.labelSmall, letterSpacing: 0.8 },
  unitGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },

  unitCard: {
    flexGrow: 1,
    flexBasis: UNIT_MIN_W,
    maxWidth: 320,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    gap: 6,
    minHeight: 108,
  },
  unitHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  unitName: { ...theme.typography.bodyBold, fontSize: 15 },
  unitSeats: { ...theme.typography.captionSmall },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
  },
  statusPillText: { ...theme.typography.captionSmall, fontWeight: "700", letterSpacing: 0.4 },

  guestRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  guestName: { ...theme.typography.body, fontSize: 14, fontWeight: "600", flexShrink: 1 },
  guestCovers: { ...theme.typography.captionSmall },
  sittingTimes: { ...theme.typography.caption, fontVariant: ["tabular-nums"] },
  remaining: { ...theme.typography.caption, fontWeight: "700" },
  nextUp: { ...theme.typography.captionSmall },

  empty: { alignItems: "center", paddingVertical: 60, gap: theme.spacing.md },
  emptyText: { ...theme.typography.body, fontStyle: "italic", textAlign: "center" },
});
