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
  // The reference gets its own recessed strip with the copy affordance beside it, rather
  // than a badge floating in the header — it's the one value here that exists to be read
  // back to the restaurant, so it sits where a receipt would print it.
  refStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  refTextGroup: { flexShrink: 1, minWidth: 0, gap: 3 },
  refLabel: { ...theme.typography.labelSmall, textTransform: "uppercase", letterSpacing: 0.6 },
  refValue: { ...theme.typography.bodyBold, fontWeight: "700", letterSpacing: 0.3 },
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
