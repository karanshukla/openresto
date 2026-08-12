import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    width: "100%",
  },
  // A translucent band of the page colour behind the button, so the row's own content
  // reads as passing underneath it rather than colliding with it.
  affordance: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 44,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  affordanceStart: {
    left: 0,
    borderTopRightRadius: theme.borderRadius.xl,
    borderBottomRightRadius: theme.borderRadius.xl,
  },
  affordanceEnd: {
    right: 0,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderBottomLeftRadius: theme.borderRadius.xl,
  },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
});
