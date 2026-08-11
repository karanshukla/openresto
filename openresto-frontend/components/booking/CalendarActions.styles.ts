import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  compactWrap: { padding: 16, borderRadius: 10, gap: 10 },
  compactRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  compactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    minWidth: 70,
    maxWidth: 100,
    justifyContent: "center",
  },
  compactBtnText: { fontSize: 12, fontWeight: "600" },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  fullWrap: { gap: 6 },
  fullBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  fullBtnContent: { flex: 1, gap: 1 },
  fullBtnText: { fontSize: 14, fontWeight: "600" },
  fullBtnSub: { fontSize: 11 },
});
