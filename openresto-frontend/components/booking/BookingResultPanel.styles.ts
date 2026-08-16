import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

// The map is a DOM <iframe>, so this is plain CSS, not an RN style: `border` has no RN
// equivalent and StyleSheet.create rejects it, but without the reset the browser draws its
// own inset frame inside the rounded corners.
export const mapFrameStyle = {
  display: "block",
  width: "100%",
  height: 150,
  borderRadius: theme.borderRadius.md,
  border: "none",
} as object;

export const styles = StyleSheet.create({
  // One card, sections divided by hairlines, rather than a stack of separately-shadowed
  // cards each carrying its own padding scale — the reservation reads as one document.
  card: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    overflow: "hidden",
    width: "100%",
    ...theme.shadows.md,
  },
  // The outcome line is the one centred thing in the card — everything below it is a
  // left-read list — because it's the answer the diner came for.
  cardHeader: {
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  title: { ...theme.typography.h3, flexShrink: 1 },
  refRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
  },
  refBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.md,
  },
  refText: { ...theme.typography.bodyBold, fontWeight: "700", letterSpacing: 0.3 },
  divider: { height: 1 },
  mapSection: { padding: theme.spacing.lg, paddingBottom: 0 },
  cancelSection: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    alignItems: "center",
  },
  cancelHint: {
    ...theme.typography.caption,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: theme.spacing.sm,
  },
});
