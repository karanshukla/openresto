import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  wrap: { gap: 8 },
  note: { ...theme.typography.caption },
});
