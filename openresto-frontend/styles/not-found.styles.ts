import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { alignItems: "center", gap: 12, padding: 32 },
  code: { fontSize: 72, fontWeight: "700", letterSpacing: -2, opacity: 0.15 },
  title: { fontSize: 22, fontWeight: "600", letterSpacing: -0.3 },
  path: { fontSize: 13, fontFamily: "monospace" },
  link: { fontSize: 15, fontWeight: "500", marginTop: 8 },
});
