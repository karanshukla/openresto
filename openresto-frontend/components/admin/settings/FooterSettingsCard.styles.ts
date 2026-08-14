import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  saveMsg: { marginTop: theme.spacing.xs },
  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignSelf: "flex-start",
    marginTop: theme.spacing.sm,
  },
  saveBtnText: { fontSize: 13, fontWeight: "600", color: theme.colors.white },
  divider: { height: 1, marginVertical: theme.spacing.xs },
  linksSection: { gap: theme.spacing.md },
  linksList: { gap: theme.spacing.sm },
});
