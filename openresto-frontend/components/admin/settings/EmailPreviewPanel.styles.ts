import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

/**
 * The email itself renders inside a DOM <iframe>, so its box is plain CSS rather than an RN
 * style — the same split `BookingResultPanel` makes for its map.
 */
export const frameStyle = {
  width: "100%",
  height: 460,
  border: "0",
  display: "block",
  backgroundColor: "#f9fafb",
} as const;

export const styles = StyleSheet.create({
  panel: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1 },
  headerTitle: { ...theme.typography.bodyBold },
  headerSub: { ...theme.typography.caption, marginTop: 1 },
  body: {
    borderTopWidth: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  // The mail-client chrome around the rendered body: the three header lines a guest sees above
  // it in their inbox, which is where fromName/fromEmail land.
  envelope: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
  },
  envelopeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xsm,
  },
  envelopeRowDivider: { borderTopWidth: 1 },
  envelopeLabel: { fontSize: 11, fontWeight: "600", width: 56, lineHeight: 16 },
  envelopeValue: { flex: 1, fontSize: 12, lineHeight: 16 },
  envelopeSubject: { fontWeight: "700" },
  frame: {
    borderTopWidth: 1,
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.xsm,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17 },
  hint: { fontSize: 11, lineHeight: 15 },
  loading: { padding: theme.spacing.xl, alignItems: "center" },
});
