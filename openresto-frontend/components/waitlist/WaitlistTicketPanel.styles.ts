import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  root: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  name: { ...theme.typography.h2, textAlign: "center" },
});
