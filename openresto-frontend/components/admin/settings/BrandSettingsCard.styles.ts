import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  swatchRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "center",
    flexWrap: "wrap",
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderColor: theme.colors.white,
    shadowColor: theme.colors.black,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  hexInput: { width: 100 },
  faviconGrid: { flexDirection: "row", gap: theme.spacing.sm, flexWrap: "wrap" },
  faviconSwatch: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  heroFitField: { gap: theme.spacing.xxs },
  heroFitHint: { fontSize: 11 },
  heroBlock: { gap: theme.spacing.sm, marginTop: theme.spacing.sm },
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
  saveBtn: { marginTop: theme.spacing.xs },
});

/** Plain-DOM styles for the `<img>` previews in this card, which only ever render on web. */
export const domStyles = {
  faviconImage: { width: 22, height: 22 },
  heroImage: { width: "100%", height: "100%", objectFit: "cover" },
} as const;
