import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    // The three controls hold a fixed minimum width, so once the booking panel takes 460px
    // off the list column there is nothing left for the summary and it spills out of the
    // bar. Wrapping drops it onto its own line instead, still right-aligned, and does the
    // same for a control itself on a phone too narrow to hold all three.
    flexWrap: "wrap",
    gap: theme.spacing.xsm,
    borderRadius: theme.borderRadius.card,
    padding: theme.spacing.md,
  },
  barCompact: {
    gap: theme.spacing.sm,
    padding: theme.spacing.xsm,
  },
  // Pinned: the band behind the bar is the header surface, so the bar itself contributes
  // nothing but the controls and the padding holding them off the band's edges.
  barFlat: {
    backgroundColor: "transparent",
    borderRadius: 0,
  },
  controlSeats: {
    minWidth: 132,
  },
  controlDate: {
    minWidth: 170,
  },
  controlMeal: {
    minWidth: 150,
  },
  // A share of the row is not a promise of enough room: at a 1:2:2 split a 390px phone
  // leaves the seat trigger 64px, which is less than its own icon, digits and chevron, so
  // the count ellipsised down to a stray dot. The floors are what each trigger actually
  // needs, and the bar wraps when they no longer fit rather than squeezing one of them.
  controlCompactSeats: {
    flex: 1,
    minWidth: 80,
  },
  controlCompactWide: {
    flex: 2,
    minWidth: 116,
  },
  summary: {
    marginLeft: "auto",
    paddingRight: theme.spacing.xs,
    fontSize: 12.5,
  },
});
