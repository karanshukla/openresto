import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";
import { styles as setupStyles } from "./NativeAppSetupCard.styles";

export const styles = StyleSheet.create({
  ...setupStyles,
  probe: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, minHeight: 28 },
  probeText: { flex: 1 },
});
