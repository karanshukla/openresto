import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  // Both variants are a section inside the booking card, so they carry the card's own
  // padding rather than a tinted inner box — a card within a card reads as a mistake.
  compactWrap: { padding: theme.spacing.lg, gap: 10 },
  compactRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  compactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    minWidth: 70,
    justifyContent: "center",
  },
  compactBtnText: { fontSize: 12, fontWeight: "600" },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  fullWrap: { padding: theme.spacing.lg, gap: 8 },
  fullBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  fullBtnContent: { flex: 1, gap: 1 },
  fullBtnText: { fontSize: 14, fontWeight: "600" },
  fullBtnSub: { fontSize: 11 },
});
