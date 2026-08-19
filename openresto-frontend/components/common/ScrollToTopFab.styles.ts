import { StyleSheet } from "react-native";

export const FAB_SIZE = 48;

export const styles = StyleSheet.create({
  // Spans the container so the FAB can be laid out against its content column rather than
  // its own corner; `box-none` keeps the strip from swallowing presses meant for the page.
  lane: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "flex-end",
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
});
