import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  heroBlock: { gap: theme.spacing.sm },
  heroFrame: {
    width: "100%",
    aspectRatio: 16 / 5,
    borderRadius: theme.borderRadius.md,
    overflow: "hidden",
    borderWidth: 1,
  },
  heroPlaceholder: {
    width: "100%",
    aspectRatio: 16 / 5,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xxs,
  },
  heroPlaceholderText: { fontSize: 12 },
  heroActions: { flexDirection: "row", gap: theme.spacing.sm },
});

/** Plain-DOM styles for the `<img>` preview, which only ever renders on web. */
export const domStyles = {
  heroImage: { width: "100%", height: "100%", objectFit: "cover" },
} as const;
