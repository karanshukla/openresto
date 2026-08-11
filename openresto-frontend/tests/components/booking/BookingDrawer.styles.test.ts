/**
 * @jest-environment jsdom
 *
 * The sheet is dismissed by dragging it downwards, which on a mobile browser is also the
 * pull-to-refresh gesture. Losing that race reloads the page, taking the sheet, the held
 * table and anything already typed into the booking form with it.
 */
import { StyleSheet, type ViewStyle } from "react-native";

function stylesOn(platform: string) {
  let loaded: Record<string, ViewStyle> = {};
  jest.isolateModules(() => {
    jest.doMock("react-native", () => {
      const rn = jest.requireActual("react-native");
      // A Proxy rather than a spread: react-native's index is a wall of lazy getters, and
      // reading every one of them to copy it drags in native modules that aren't there.
      return new Proxy(rn, {
        get: (target, prop) =>
          prop === "Platform" ? { ...target.Platform, OS: platform } : target[prop],
      });
    });
    loaded = require("@/components/booking/BookingDrawer.styles").styles;
  });
  return loaded;
}

describe("BookingDrawer styles on web", () => {
  const styles = stylesOn("web");
  const flat = (style: ViewStyle) => StyleSheet.flatten(style) as Record<string, unknown>;

  it.each([
    ["grabberArea", "the drag handle"],
    ["header", "the header, which drags the sheet too"],
    ["backdrop", "the backdrop over the page behind"],
  ])("claims the touch gesture on %s", (key) => {
    expect(flat(styles[key]).touchAction).toBe("none");
  });

  it("stops the form's scroll chaining out to the page at its top", () => {
    expect(flat(styles.scroll).overscrollBehavior).toBe("contain");
  });
});

describe("BookingDrawer styles on native", () => {
  const styles = stylesOn("ios");
  const flat = (style: ViewStyle) => StyleSheet.flatten(style) as Record<string, unknown>;

  it("leaves the web-only escape hatches off", () => {
    // Neither property exists in React Native, and a native sheet has no browser gesture
    // to fend off in the first place.
    expect(flat(styles.grabberArea).touchAction).toBeUndefined();
    expect(flat(styles.scroll).overscrollBehavior).toBeUndefined();
  });
});
