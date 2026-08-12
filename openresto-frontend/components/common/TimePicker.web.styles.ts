import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 0,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  chevron: {
    fontSize: 14,
  },
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay.light,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  panel: {
    width: 240,
    maxHeight: 360,
    borderWidth: 1,
    borderRadius: theme.borderRadius.card,
    overflow: "hidden",
    paddingVertical: 8,
  },
  panelTitle: {
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  list: {
    width: "100%",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  checkmark: {
    fontWeight: "600",
  },
});
