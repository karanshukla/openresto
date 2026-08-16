import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  tags: {
    flexDirection: "row",
    gap: theme.spacing.xxs,
    flexWrap: "wrap",
  },
  tag: {
    paddingHorizontal: theme.spacing.xsm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  tagText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
});
