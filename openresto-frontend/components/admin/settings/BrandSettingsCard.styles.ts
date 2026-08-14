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
});

/** Plain-DOM styles for the favicon previews in this card, which only ever render on web. */
export const domStyles = {
  faviconImage: { width: 22, height: 22 },
} as const;
