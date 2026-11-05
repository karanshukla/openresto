import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  body: { gap: theme.spacing.md },
  intro: { fontSize: 13, lineHeight: 19, maxWidth: 720 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
  },
  origin: { fontSize: 14 },
});
