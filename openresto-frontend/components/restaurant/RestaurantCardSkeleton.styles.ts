import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  card: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    overflow: "hidden",
    flex: 1,
  },
  // Mirrors RestaurantCard's imageArea: the aspect ratio is what stops the grid
  // resizing when the real cards land.
  image: {
    aspectRatio: 16 / 9,
  },
  body: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  slotRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
  },
});
