import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  wrap: { padding: theme.spacing.lg, gap: 10 },
  title: {
    ...theme.typography.labelSmall,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  note: { ...theme.typography.caption },
});
