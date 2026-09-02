import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.xxs,
  },
  title: {
    ...theme.typography.pageTitle,
    lineHeight: 38,
  },
  subtitle: {
    ...theme.typography.body,
  },
});
