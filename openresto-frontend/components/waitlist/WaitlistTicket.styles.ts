import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  root: {
    gap: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 8,
    alignItems: "center",
  },
  ticket: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
    textAlign: "center",
  },
  line: {
    fontSize: 16,
    textAlign: "center",
  },
  muted: {
    fontSize: 14,
    textAlign: "center",
  },
});
