import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  // Left-read, not centred: the header stopped being a lone outcome banner once the
  // restaurant, address and seating moved into it, and a centred three-line block sets a
  // ragged edge against the left-aligned facts directly beneath it.
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.xxs,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xxs },
  status: { ...theme.typography.labelSmall, textTransform: "uppercase", letterSpacing: 0.8 },
  name: { ...theme.typography.h2 },
  seating: { ...theme.typography.body, lineHeight: 20 },
});
