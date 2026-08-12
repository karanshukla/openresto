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

  header: {
    padding: theme.spacing.xl,
    paddingHorizontal: 22,
    flexDirection: "row",
    gap: theme.spacing.xl,
    alignItems: "center",
    borderBottomWidth: 1,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: theme.borderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerName: { fontSize: 20, fontWeight: "600", letterSpacing: -0.3, marginBottom: 5 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: 13 },
  metaDot: { width: 3, height: 3, borderRadius: 1.5 },
  stats: { alignItems: "flex-end", gap: theme.spacing.xsm, flexShrink: 0 },
  statsRow: { flexDirection: "row", gap: theme.spacing.xxs },

  imageRow: {
    paddingHorizontal: 22,
    paddingVertical: theme.spacing.lg,
    flexDirection: "row",
    gap: theme.spacing.lg,
    alignItems: "center",
    borderBottomWidth: 1,
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
  imageTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: theme.spacing.sm,
    marginBottom: 3,
  },
  imageTitle: { fontSize: 14, fontWeight: "600", letterSpacing: -0.1 },
  imageOptional: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 },
  imageHint: { fontSize: 12, marginBottom: theme.spacing.xsm },
  imageActions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "center",
    flexWrap: "wrap",
  },
  imageMsg: { fontSize: 12 },

  infoBlock: { padding: 22, borderBottomWidth: 1 },
  sectionsBlock: { padding: 22 },
  sectionsTitle: { fontSize: 15, fontWeight: "600", letterSpacing: -0.2, marginBottom: 3 },
  sectionsSub: { fontSize: 13, marginBottom: theme.spacing.xl },
  sectionsList: { gap: 14 },
  sectionsEmpty: { fontSize: 13, fontStyle: "italic" },
  addSectionRow: { marginTop: theme.spacing.md },
});

/** Plain-DOM style for the `<img>` preview, which only ever renders on web. */
export const domStyles = {
  image: { width: "100%", height: "100%", objectFit: "cover" },
} as const;
