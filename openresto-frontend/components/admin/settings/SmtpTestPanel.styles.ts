import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  panel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
  },
  indicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  idleDot: { width: 8, height: 8, borderRadius: 4 },
  failMark: { fontSize: 18, fontWeight: "700", color: theme.colors.white, lineHeight: 20 },
  copy: { flex: 1 },
  title: { fontSize: 13.5, fontWeight: "600" },
  subtitle: { fontSize: 12, marginTop: 2 },
});
