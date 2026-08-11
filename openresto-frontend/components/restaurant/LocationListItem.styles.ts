import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  item: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.card,
    overflow: "hidden",
  },

  // ── Wide (desktop/tablet) header ──
  wideHeader: {
    flexDirection: "row",
    gap: 14,
    padding: theme.spacing.md,
  },
  wideContent: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.sm,
  },
  wideTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.xsm,
  },
  wideIdentity: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },

  // ── Compact (phone) header ──
  compactHeader: {
    padding: theme.spacing.md,
    gap: theme.spacing.xsm,
  },
  compactTopRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  compactIdentity: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xs,
  },
  compactFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderStyle: "dashed",
  },

  thumb: {
    flexShrink: 0,
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbInitial: {
    fontSize: 34,
    fontWeight: "700",
    color: "rgba(255,255,255,0.28)",
    letterSpacing: -1.5,
  },
  thumbInitialCompact: {
    fontSize: 24,
    letterSpacing: -1,
  },

  name: {
    fontSize: 19,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minWidth: 0,
  },
  metaText: {
    fontSize: 13,
  },
  metaLink: {
    fontWeight: "500",
  },

  detailsBtn: {
    flexShrink: 0,
    minHeight: 36,
  },

  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xxs,
    flexWrap: "wrap",
  },
  slotRowCompact: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: theme.spacing.xxs,
  },
  slot: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  slotCompact: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    paddingHorizontal: theme.spacing.sm,
    minHeight: theme.formSizes.inputHeight,
  },
  // The overflow chip sizes to its label and never shrinks — "+12" must not be
  // squeezed off the row's right edge by the three flexible time chips.
  slotMoreCompact: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
    paddingHorizontal: theme.spacing.md,
    minHeight: theme.formSizes.inputHeight,
  },
  slotText: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  slotMoreText: {
    fontSize: 13,
    fontWeight: "600",
  },
  slotMoreInline: {
    fontSize: 12.5,
    marginLeft: theme.spacing.xs,
  },
  slotsLoading: {
    alignSelf: "flex-start",
    minHeight: theme.formSizes.inputHeight,
  },
  noSlotsText: {
    fontSize: 12.5,
    fontStyle: "italic",
  },
  walkInRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xxs,
    paddingVertical: 9,
  },
  walkInText: {
    fontSize: 12.5,
    fontStyle: "italic",
  },

  // ── Details body ──
  expandedBody: {
    padding: theme.spacing.lg,
    gap: theme.spacing.xxl,
    borderTopWidth: 1,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  tags: {
    flexDirection: "row",
    gap: theme.spacing.xxs,
    flexWrap: "wrap",
  },
  tag: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 11.5,
  },
  mapLinks: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
  },
  mapLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.xsm,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  mapLinkText: {
    fontSize: 12.5,
    fontWeight: "500",
  },
  menuButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xsm,
    paddingHorizontal: 14,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
  },
  menuButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  menuButtonEnd: {
    marginLeft: "auto",
  },
  subSection: {
    gap: theme.spacing.md,
  },
  subHeading: {
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  sectionsGrid: {
    gap: theme.spacing.xsm,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    gap: theme.spacing.xsm,
  },
  sectionName: {
    fontSize: 15,
    fontWeight: "600",
  },
  tableGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  tableChip: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 11,
    paddingVertical: 7,
    alignItems: "center",
    gap: 2,
  },
  tableName: {
    fontSize: 13,
    fontWeight: "500",
  },
  tableSeats: {
    fontSize: 11.5,
  },
  tableNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  groupBlock: {
    gap: theme.spacing.sm,
  },
  groupBlockHeading: {
    fontSize: 11.5,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xsm,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xsm,
  },
  groupTextCol: {
    flex: 1,
    gap: 2,
  },
  groupName: {
    fontSize: 13,
    fontWeight: "600",
  },
  groupSeats: {
    fontSize: 11.5,
  },
});
