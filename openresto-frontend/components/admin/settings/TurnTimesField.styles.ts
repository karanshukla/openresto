import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  field: { gap: theme.spacing.xs },
  hint: { fontSize: 11, lineHeight: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  seatsSelect: { flexBasis: 140, flexGrow: 1, maxWidth: 200 },
  minutesSelect: { flexBasis: 120, flexGrow: 1, maxWidth: 180 },
  range: { fontSize: 12, flexShrink: 1, minWidth: 140 },
});
