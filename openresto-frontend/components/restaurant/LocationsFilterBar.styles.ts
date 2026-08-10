import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
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
