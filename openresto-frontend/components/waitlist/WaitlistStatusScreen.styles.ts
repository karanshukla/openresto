import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  page: {
    maxWidth: 560,
    width: "100%",
    alignSelf: "center",
    paddingVertical: 24,
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
