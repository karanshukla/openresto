import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  content: { alignItems: "center", gap: 12, maxWidth: 420 },
  iconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: "600", letterSpacing: -0.3, textAlign: "center" },
  message: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  btn: { paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnOutline: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  btnOutlineText: { fontWeight: "600", fontSize: 14 },
});
