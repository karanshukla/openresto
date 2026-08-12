import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
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
});
