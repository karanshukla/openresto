import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";
import { SETTINGS_ANCHOR_SLOT } from "./GuestSettingsAnchor.styles";

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
  /** Keeps a root's title out from under the settings control pinned over its top-right. */
  titleClearsSettings: {
    paddingRight: SETTINGS_ANCHOR_SLOT,
  },
});
