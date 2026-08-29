import { Platform, StyleSheet } from "react-native";

export const FAB_SIZE = 48;

/** Inset the FAB keeps from whatever it comes to rest on — the viewport's edge, or the footer. */
export const FAB_MIN_GUTTER = 20;

export const styles = StyleSheet.create({
  // The rail is a real row in the scroll content, sat between the page and the footer, and it
  // sticks to the bottom of the scrollport for as long as its own place is below the fold. That
  // is what stops the FAB an inset above the footer instead of on top of it: sticky offsets an
  // element up from where it belongs and never past it, so the browser does the arithmetic that
  // an onScroll handler used to (#399), on the compositor and without a re-render.
  //
  // React Native has no `position: sticky`, so on native the rail keeps its place in the flow and
  // the FAB arrives with the end of the page rather than riding the viewport.
  rail: {
    height: FAB_SIZE + FAB_MIN_GUTTER,
    alignItems: "flex-end",
    zIndex: 5,
    ...(Platform.OS === "web" ? ({ position: "sticky" } as object) : null),
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
