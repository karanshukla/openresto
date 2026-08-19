/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, fireEvent } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import ScrollToTopFab, {
  fabGutter,
  FAB_MIN_GUTTER,
  SHOW_AFTER_SCROLL_Y,
} from "@/components/common/ScrollToTopFab";
import { FAB_SIZE } from "@/components/common/ScrollToTopFab.styles";
import { CONTENT_MAX_WIDTH, CONTENT_PADDING_H } from "@/constants/breakpoints";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

const mockWindowDimensions = { width: 375, height: 812 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  default: () => mockWindowDimensions,
}));

describe("ScrollToTopFab", () => {
  it("exposes the scroll threshold callers gate visibility on", () => {
    expect(SHOW_AFTER_SCROLL_Y).toBe(300);
  });

  it("renders when visible", () => {
    renderWithProviders(<ScrollToTopFab visible onPress={jest.fn()} />);
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("does not render when not visible", () => {
    renderWithProviders(<ScrollToTopFab visible={false} onPress={jest.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  // The FAB used to be gated to portrait phones under 700px wide, which hid it
  // from exactly the wide layouts that scroll furthest. Viewport size must not
  // affect it at all now, so drive a desktop landscape window and a phone
  // portrait one through the same assertion.
  it.each([
    ["desktop landscape", { width: 1440, height: 900 }],
    ["tablet landscape", { width: 1024, height: 768 }],
    ["phone portrait", { width: 375, height: 812 }],
  ])("renders on %s", (_label, dimensions) => {
    const wdModule = require("react-native/Libraries/Utilities/useWindowDimensions");
    const original = wdModule.default;
    wdModule.default = () => dimensions;
    try {
      renderWithProviders(<ScrollToTopFab visible onPress={jest.fn()} />);
      expect(screen.getByRole("button")).toBeTruthy();
    } finally {
      wdModule.default = original;
    }
  });

  // The FAB used to be pinned to its container's own corner, which on a wide monitor left
  // it stranded a few hundred pixels out from everything else on the page (#352). It now
  // lives in the gutter beside the content column, tucked against the column's right edge
  // — which is also where the footer's own row ends, so the two no longer collide.
  describe("fabGutter", () => {
    const columnEdge = (width: number) => (width - CONTENT_MAX_WIDTH) / 2 + CONTENT_PADDING_H;

    it.each([1440, 1680, 2560])("puts its left edge on the content column at %ipx", (width) => {
      expect(fabGutter(width) + FAB_SIZE).toBe(columnEdge(width));
    });

    // Below the column's cap the container has no gutter to sit in, so the FAB falls back
    // to a plain inset rather than climbing over the content.
    it.each([1320, 768, 390])(
      "holds the plain inset at %ipx, where there is no gutter",
      (width) => {
        expect(fabGutter(width)).toBe(FAB_MIN_GUTTER);
      }
    );

    // The boundary itself: the gutter has to be wider than the FAB before it can hold one.
    it("switches over once the gutter is wider than the FAB", () => {
      const tight = CONTENT_MAX_WIDTH + 2 * (FAB_SIZE + FAB_MIN_GUTTER - CONTENT_PADDING_H);
      expect(fabGutter(tight)).toBe(FAB_MIN_GUTTER);
      expect(fabGutter(tight + 2)).toBeGreaterThan(FAB_MIN_GUTTER);
    });
  });

  // The lane measures the box the FAB was mounted into, not the window: on Locations the
  // FAB sits in the list column, which the booking drawer takes half of.
  it("lays the FAB out against the column it was mounted in, not the window", () => {
    renderWithProviders(<ScrollToTopFab visible onPress={jest.fn()} />);
    const lane = screen.getByTestId("scroll-to-top-lane");

    fireEvent(lane, "layout", { nativeEvent: { layout: { width: 1680, height: 48 } } });
    expect(StyleSheet.flatten(lane.props.style).paddingRight).toBe(fabGutter(1680));

    fireEvent(lane, "layout", { nativeEvent: { layout: { width: 760, height: 48 } } });
    expect(StyleSheet.flatten(lane.props.style).paddingRight).toBe(FAB_MIN_GUTTER);
  });

  // The lift is what keeps the FAB off the footer's own links at the end of a scroll; see
  // useScrollToTopFab for where the number comes from.
  it("rises off the bottom by the lift it is given", () => {
    const { unmount } = renderWithProviders(<ScrollToTopFab visible onPress={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByTestId("scroll-to-top-lane").props.style).bottom).toBe(
      FAB_MIN_GUTTER
    );
    unmount();

    renderWithProviders(<ScrollToTopFab visible lift={88} onPress={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByTestId("scroll-to-top-lane").props.style).bottom).toBe(
      88 + FAB_MIN_GUTTER
    );
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    renderWithProviders(<ScrollToTopFab visible onPress={onPress} />);
    fireEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
