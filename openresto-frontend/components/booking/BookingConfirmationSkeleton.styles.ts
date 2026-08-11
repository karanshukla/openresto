import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 60 },
  successHeader: { alignItems: "center", paddingTop: 48, paddingBottom: 16, gap: 10 },
  refCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    padding: 24,
    alignItems: "center",
  },
  wideRow: { flexDirection: "row", gap: 20, marginTop: 16 },
  narrowGap: { gap: 16, marginTop: 16 },
  wideCol: { flex: 1 },
  detailCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    overflow: "hidden",
  },
  actions: { gap: 10, marginTop: 16 },
  actionsWide: { flexDirection: "row", gap: 12, marginTop: 16, justifyContent: "center" },
});
