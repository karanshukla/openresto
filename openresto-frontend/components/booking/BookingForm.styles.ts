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
  // ── Drawer layout ──
  // Sections rather than one flat stack of fields: the drawer asks three separate
  // things (when, who, and optionally where you sit) and they read as one long form
  // without the headings and rules to separate them.
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
  // No border and no fill: the toggle is a row of the form, not a control wrapped around
  // the fields it reveals, which read as plain fields like every other one.
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
    color: "#6b7280",
    marginTop: -10,
  },
  // The inline layout pulls the hint up against the row above it; inside a drawer
  // section it is a normal sibling with the section's own gap.
  timezoneHintDrawer: {
    marginTop: 0,
  },
  submitContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  submitText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  textarea: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: 10,
  },
  hint: {
    opacity: 0.5,
    fontSize: 12,
    textAlign: "center",
    marginTop: -10,
  },
  gdpr: {
    fontSize: 12,
    opacity: 0.5,
    lineHeight: 18,
  },
});
