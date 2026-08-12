import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  form: {
    gap: 20,
  },
  availabilityHeader: {
    width: "100%",
    overflow: "hidden",
  },
  availabilityLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  drawerForm: {
    gap: 20,
  },
  drawerSection: {
    gap: 12,
  },
  drawerFooter: {
    gap: 12,
  },
  divider: {
    height: 1,
    marginVertical: 2,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  drawerRow: {
    flexDirection: "row",
    gap: 12,
  },
  // Halves rather than content-sized: the guests and date controls carry different label
  // lengths, and a split row is the only thing keeping them off one column each.
  drawerRowHalf: {
    flex: 1,
    minWidth: 0,
  },
  disclosureToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 28,
  },
  disclosureText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  fieldRow: {
    flexDirection: "row",
    gap: 16,
  },
  fieldRowStretch: {
    alignItems: "stretch",
  },
  // Stacked, the pair's two fields are plain siblings with no gap of their own,
  // so without this they'd sit tighter together than consecutive rows do.
  fieldRowStacked: {
    gap: 20,
  },
  holdPush: {
    marginTop: "auto",
  },
  field: {
    gap: 6,
  },
  fieldHalf: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  noTables: {
    fontSize: 13,
  },
  autoAssignHint: {
    fontSize: 13,
    fontStyle: "italic",
  },
  closedDayNotice: {
    fontSize: 13,
  },
  timezoneHint: {
    fontSize: 12,
    marginTop: -10,
  },
  // The inline layout pulls the hint up against the row above it; inside a drawer
  // section it is a normal sibling with the section's own gap.
  timezoneHintDrawer: {
    marginTop: 0,
  },
  textarea: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: 10,
  },
  // colors.muted at full opacity, not a faded text color: 0.5 opacity fell below WCAG AA
  // contrast in light mode.
  hint: {
    fontSize: 12,
    textAlign: "center",
    marginTop: -10,
  },
  gdpr: {
    fontSize: 12,
    lineHeight: 18,
  },
});
