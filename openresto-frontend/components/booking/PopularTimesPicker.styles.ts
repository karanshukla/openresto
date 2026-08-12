import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    width: "100%",
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabDisabled: {
    opacity: 0.35,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextDisabled: {
    opacity: 0.6,
  },
  scrollWrapper: {
    position: "relative",
    width: "100%",
    minHeight: 65,
  },
  slotsScroll: {
    width: "100%",
  },
  slotsContainer: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  wrappedSlots: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  scrollIndicator: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 44,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  leftIndicator: {
    left: 0,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  rightIndicator: {
    right: 0,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  slotChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 70,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    elevation: 1,
  },
  slotText: {
    fontSize: 14,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.6,
    fontStyle: "italic",
    paddingVertical: 12,
  },
});
