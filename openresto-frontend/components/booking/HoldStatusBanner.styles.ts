import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  holdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    backgroundColor: "transparent",
  },
  holdPending: {
    opacity: 0.6,
    fontSize: 13,
  },
  holdHeld: {
    fontSize: 13,
    fontWeight: "600",
  },
  holdUnavailable: {
    fontSize: 13,
  },
  expiredBox: {
    gap: 8,
    marginTop: 6,
    backgroundColor: "transparent",
  },
  refreshBtn: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  refreshBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
