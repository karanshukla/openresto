import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  subLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "600",
    marginBottom: theme.spacing.xsm,
  },
  track: {
    width: 34,
    height: 20,
    borderRadius: theme.borderRadius.full,
    padding: 2,
    justifyContent: "center",
    flexShrink: 0,
  },
  trackDisabled: { opacity: 0.5 },
  knob: {
    width: 16,
    height: 16,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.white,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1,
  },
});
