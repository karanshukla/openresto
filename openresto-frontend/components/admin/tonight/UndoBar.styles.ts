import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    bottom: theme.spacing.lg,
    alignSelf: "center",
    maxWidth: 560,
    marginHorizontal: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    paddingVertical: theme.spacing.sm,
    paddingLeft: theme.spacing.lg,
    paddingRight: theme.spacing.sm,
    ...theme.shadows.lg,
  },
  message: { ...theme.typography.bodyBold, flex: 1 },
});
