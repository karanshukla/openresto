import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  statChip: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: theme.spacing.sm,
    minWidth: 72,
    alignItems: "flex-start",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.5,
    lineHeight: 24,
    marginBottom: 3,
  },
  statLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.7 },
  statsRow: { flexDirection: "row", gap: theme.spacing.xxs },

  imageRow: {
    flexDirection: "row",
    gap: theme.spacing.lg,
    alignItems: "center",
  },
  imageFrame: {
    width: 96,
    height: 68,
    borderRadius: theme.borderRadius.md,
    overflow: "hidden",
    borderWidth: 1,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  imageCopy: { flex: 1 },
  imageHint: { fontSize: 12, marginBottom: theme.spacing.xsm },
  imageActions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "center",
    flexWrap: "wrap",
  },
  imageMsg: { fontSize: 12 },

  sectionsSub: { fontSize: 13 },
  sectionsList: { gap: 14 },
  sectionsEmpty: { fontSize: 13, fontStyle: "italic" },
  addSectionRow: { marginTop: theme.spacing.md },
});

/** Plain-DOM style for the `<img>` preview, which only ever renders on web. */
export const domStyles = {
  image: { width: "100%", height: "100%", objectFit: "cover" },
} as const;
