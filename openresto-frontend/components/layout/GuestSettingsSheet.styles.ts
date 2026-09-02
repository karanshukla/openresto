import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  helpBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  sectionLabel: {
    marginTop: theme.spacing.lg,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  list: {
    marginTop: theme.spacing.sm,
    gap: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.md,
  },
  rowText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
