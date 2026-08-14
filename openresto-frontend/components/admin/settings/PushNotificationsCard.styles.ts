import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  notice: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.xsm },
  noticeIcon: { marginTop: 1 },
  noticeText: { fontSize: 13, flex: 1, lineHeight: 19 },
  body: { gap: theme.spacing.md },
  bodyText: { fontSize: 13, lineHeight: 19 },
  error: { fontSize: 13, color: theme.colors.error },
});
