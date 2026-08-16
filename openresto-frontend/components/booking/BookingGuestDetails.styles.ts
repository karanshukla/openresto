import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  section: { padding: theme.spacing.lg, gap: theme.spacing.md },
  row: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.xsm },
  icon: { marginTop: 3 },
  content: { flex: 1, minWidth: 0, gap: 2 },
  primary: { ...theme.typography.bodyBold, fontSize: 14, lineHeight: 20 },
  secondary: { ...theme.typography.caption, fontSize: 13, lineHeight: 18 },
  secondaryStrong: { fontSize: 14, lineHeight: 20 },
  label: { ...theme.typography.labelSmall, textTransform: "uppercase", letterSpacing: 0.4 },
});
