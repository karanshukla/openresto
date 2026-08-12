import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  modeBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: "transparent",
  },
  modeBtnActive: { borderWidth: 1 },
  modeBtnLabel: { fontSize: 12, fontWeight: "500" },
  modeBtnLabelActive: { fontWeight: "600" },
});
