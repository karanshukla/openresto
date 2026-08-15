import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  fields: { flexDirection: "row", gap: theme.spacing.md },
  extraField: { flex: 1 },
});
