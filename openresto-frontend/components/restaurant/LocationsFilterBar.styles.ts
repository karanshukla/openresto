import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    // The three controls hold a fixed minimum width, so once the booking panel takes 460px
    // off the list column there is nothing left for the summary and it spills out of the
    // bar. Wrapping drops it onto its own line instead, still right-aligned.
    flexWrap: "wrap",
    gap: theme.spacing.xsm,
    borderWidth: 1,
    borderRadius: theme.borderRadius.card,
    padding: theme.spacing.md,
  },
  barCompact: {
    gap: theme.spacing.sm,
    padding: theme.spacing.xsm,
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
  controlCompactSeats: {
    flex: 1,
  },
  controlCompactWide: {
    flex: 2,
  },
  summary: {
    marginLeft: "auto",
    paddingRight: theme.spacing.xs,
    fontSize: 12.5,
  },
});
