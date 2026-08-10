import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 11,
    position: "relative",
  },
  dayCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  todayBar: {
    position: "absolute",
    left: -theme.spacing.lg,
    top: "50%",
    marginTop: -9,
    width: 3,
    height: 18,
    borderRadius: 2,
  },
  dayText: {
    fontSize: 14,
  },
  hoursCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hoursText: {
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  closedText: {
    fontSize: 14,
    fontStyle: "italic",
  },
  walkInBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  walkInText: {
    fontSize: 11,
    fontWeight: "500",
  },
});
