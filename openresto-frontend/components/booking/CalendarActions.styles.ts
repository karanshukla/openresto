import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  // A section inside the booking card, so it carries the card's own padding rather than a
  // tinted inner box — a card within a card reads as a mistake.
  wrap: { padding: theme.spacing.lg, gap: 10 },
  title: {
    ...theme.typography.labelSmall,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
});
