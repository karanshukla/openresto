import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 },
  notFoundText: { fontSize: 16, marginTop: 8 },
  retryBtn: {
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xsm,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
  },
  retryBtnText: { fontSize: 14, fontWeight: "600" },

  // Header — mirrors lookup page
  header: { alignItems: "center", gap: 8, marginTop: 8, marginBottom: 20 },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.6, marginTop: 8 },
  subtitle: { fontSize: 15, textAlign: "center", lineHeight: 22 },

  // Two-column layout
  wideRow: { flexDirection: "row", gap: theme.spacing.xl, alignItems: "stretch" },
  narrowGap: { gap: theme.spacing.lg },
  wideCol: { flex: 1 },
  rightCol: { gap: theme.spacing.lg, flexDirection: "column" },

  // Detail rows card
  detailCard: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    overflow: "hidden",
    ...theme.shadows.md,
  },

  // Reference card
  refCard: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    padding: theme.spacing.lg,
    alignItems: "center",
    gap: theme.spacing.md,
    ...theme.shadows.md,
  },
  refLabel: {
    ...theme.typography.labelSmall,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  refRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xsm,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  refBadge: { ...theme.buttonSizes.md, borderRadius: theme.borderRadius.lg },
  refValue: { ...theme.typography.h2, fontWeight: "800" },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: theme.spacing.xsm,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
  },
  copyBtnText: { ...theme.typography.caption, fontWeight: "600" },
  refHint: { ...theme.typography.caption, textAlign: "center" },
  savedNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingTop: theme.spacing.sm,
    marginTop: theme.spacing.xsm,
    borderTopWidth: 1,
  },
  savedNoteText: { ...theme.typography.caption, opacity: 0.75 },

  // Calendar card
  actionCard: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.xsm,
    ...theme.shadows.md,
  },

  directionsCard: { gap: theme.spacing.sm },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: theme.spacing.sm,
  },
  cancelBtnText: { color: theme.colors.error, ...theme.typography.bodyBold },
  cancelHint: {
    ...theme.typography.caption,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: theme.spacing.sm,
  },
  // Directions card — same pill style as restaurant card homepage
  mapAddressRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  mapMeta: { flexDirection: "row", alignItems: "flex-start", gap: 5, flex: 1 },
  mapAddress: { fontSize: 13, flex: 1, lineHeight: 18 },
  mapLinks: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  mapLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  mapLinkText: { fontSize: 12.5, fontWeight: "600" },
});
