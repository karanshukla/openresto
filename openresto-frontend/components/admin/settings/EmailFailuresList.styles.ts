import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  wrapper: { gap: theme.spacing.sm },
  list: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    overflow: "hidden",
  },
  entry: {
    padding: theme.spacing.md,
    paddingHorizontal: 14,
    gap: 3,
  },
  entryHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xxs },
  recipient: { fontSize: 12.5, fontWeight: "500", flex: 1 },
  timestamp: { fontSize: 11 },
  // Indented to clear the warning glyph + its gap, so the detail lines hang off the recipient.
  detail: { fontSize: 11.5, paddingLeft: 19 },
});
