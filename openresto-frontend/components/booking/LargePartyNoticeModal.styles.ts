import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xxl,
  },
  card: {
    borderRadius: theme.borderRadius.modal,
    borderWidth: 1,
    padding: theme.spacing.xxl,
    width: "100%",
    maxWidth: 400,
    gap: theme.spacing.md,
    ...theme.shadows.popup,
  },
  message: {
    ...theme.typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  contacts: {
    gap: theme.spacing.sm,
  },
  noContacts: {
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 18,
  },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  btn: {
    paddingVertical: 11,
    borderRadius: theme.borderRadius.lg,
    alignItems: "center",
    marginTop: theme.spacing.sm,
  },
  btnText: {
    color: theme.colors.white,
    ...theme.typography.bodyBold,
    fontWeight: "700",
  },
});
