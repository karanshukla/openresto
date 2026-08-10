import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  message: {
    ...theme.typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  action: {
    marginTop: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
  },
});
