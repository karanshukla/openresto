/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, fireEvent } from "@testing-library/react-native";
import { Platform, Text, View } from "react-native";
import HorizontalScroller from "@/components/common/HorizontalScroller";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

/** Report a row wider than the space it has, the way a real overflowing row would. */
function overflow(width = 300, content = 900) {
  fireEvent(screen.getByTestId("rail"), "layout", { nativeEvent: { layout: { width } } });
  fireEvent(screen.getByTestId("rail"), "contentSizeChange", content, 100);
}

function scrollTo(x: number) {
  fireEvent.scroll(screen.getByTestId("rail"), { nativeEvent: { contentOffset: { x } } });
}

const renderRail = (props = {}) =>
  renderWithProviders(
    <HorizontalScroller testID="rail" label="Locations" {...props}>
      <View>
        <Text>Downtown</Text>
      </View>
    </HorizontalScroller>
  );

describe("HorizontalScroller", () => {
  it("names the row so a screen reader has something to announce", () => {
    renderRail();
    expect(screen.getByTestId("rail").props.accessibilityLabel).toBe("Locations");
    expect(screen.getByTestId("rail").props.role).toBe("group");
  });

  it("offers a way on only while there is something to scroll to", () => {
    renderRail();
    // A row that fits says nothing.
    expect(screen.queryByLabelText("Scroll Locations right")).toBeNull();

    overflow();
    expect(screen.getByLabelText("Scroll Locations right")).toBeTruthy();
    // Nothing behind us yet, so no way back.
    expect(screen.queryByLabelText("Scroll Locations left")).toBeNull();

    scrollTo(200);
    expect(screen.getByLabelText("Scroll Locations left")).toBeTruthy();

    // At the far end the forward button retires.
    scrollTo(600);
    expect(screen.queryByLabelText("Scroll Locations right")).toBeNull();
    expect(screen.getByLabelText("Scroll Locations left")).toBeTruthy();
  });

  it("tells assistive tech the row scrolls, but only when it does", () => {
    renderRail();
    expect(screen.getByTestId("rail").props.accessibilityHint).toBeUndefined();

    overflow();
    expect(screen.getByTestId("rail").props.accessibilityHint).toBe("Scrolls horizontally");
  });

  it("drives the row from its buttons", () => {
    renderRail();
    overflow();

    // The ScrollView ref's scrollTo is a no-op under the test renderer, so this asserts
    // the buttons are wired and don't throw; the direction they take is covered by the
    // arithmetic in scrollBy.
    fireEvent.press(screen.getByLabelText("Scroll Locations right"));
    scrollTo(200);
    fireEvent.press(screen.getByLabelText("Scroll Locations left"));
    expect(screen.getByTestId("rail")).toBeTruthy();
  });

  it("leaves the buttons off for a row that indicates itself another way", () => {
    renderRail({ scrollButtons: false });
    overflow();

    expect(screen.queryByLabelText("Scroll Locations right")).toBeNull();
    // The region is still named and still says it scrolls.
    expect(screen.getByTestId("rail").props.accessibilityHint).toBe("Scrolls horizontally");
  });

  it("takes a tab stop only when asked, since focusable children already provide one", () => {
    // The tab stop is a web concern: react-native-web renders no tabindex of its own,
    // while native has no such thing to render.
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    try {
      const { unmount } = renderRail();
      expect(screen.getByTestId("rail").props.tabIndex).toBeUndefined();
      unmount();

      renderRail({ keyboardFocusable: true });
      expect(screen.getByTestId("rail").props.tabIndex).toBe(0);
    } finally {
      Object.defineProperty(Platform, "OS", { get: () => originalOS, configurable: true });
    }
  });
});
