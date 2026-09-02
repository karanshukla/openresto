import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  list: {
    gap: theme.spacing.xxs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    // The WCAG 2.5.5 target the admin's controls are held to.
    minHeight: 44,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  rowText: {
    ...theme.typography.body,
  },
  fine: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
  },
  help: {
    fontSize: 13,
    lineHeight: 19,
  },
});
