import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  item: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.card,
    overflow: "hidden",
  },

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
    gap: theme.spacing.xxs,
  },

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
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  /**
   * The status line shares this row with Details and Book now, and it is the only one of the
   * three that can give ground. Without a shrinking box around it the walk-in sentence takes
   * its full intrinsic width and pushes the buttons clean off the card.
   */
  compactFootLead: {
    flex: 1,
    minWidth: 0,
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

  /**
   * Column and row gaps are deliberately different. Address, hours and menu wrap against the
   * card's width, and at the column gap a wrapped line reads as a new block rather than as a
   * continuation of the one above it.
   */
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 14,
    rowGap: theme.spacing.xs,
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
    lineHeight: 18,
  },
  metaLink: {
    fontWeight: "500",
  },

  detailsBtn: {
    flexShrink: 0,
    minHeight: 36,
  },
  /** Details beside Book now: source order is reading order, so the filled CTA lands last. */
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    flexShrink: 0,
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
    minHeight: theme.a11y.minTouchTarget,
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
    lineHeight: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  slotMoreText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "600",
  },
  slotMoreInline: {
    fontSize: 12.5,
    lineHeight: 17,
    marginLeft: theme.spacing.xs,
  },
  slotsLoading: {
    alignSelf: "flex-start",
    minHeight: theme.formSizes.inputHeight,
  },
  noSlotsText: {
    fontSize: 12.5,
    lineHeight: 17,
    fontStyle: "italic",
  },
  walkInRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xxs,
    paddingVertical: 9,
  },
  walkInText: {
    flexShrink: 1,
    fontSize: 12.5,
    lineHeight: 17,
    fontStyle: "italic",
  },

  /**
   * Horizontal padding matches the header's, so the panel's text starts on the same line as
   * the thumbnail above it rather than 4px inside it.
   */
  expandedBody: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.xxl,
    borderTopWidth: 1,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  tagRow: {
    marginTop: theme.spacing.sm,
  },
  mapLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xsm,
    flexWrap: "wrap",
  },
  mapLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.xsm,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
  },
  mapLinkText: {
    fontSize: 12.5,
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
