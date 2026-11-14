import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  tray: { gap: theme.spacing.sm },
  title: { ...theme.typography.label },
  more: { fontSize: 13, lineHeight: 18 },
});
