/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, fireEvent } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import ScrollToTopFab, {
  fabGutter,
  fabRestingBand,
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

  // The lane stays mounted while hidden so it keeps its measured width; unmounting it dropped
  // that to zero and the FAB reappeared against the fallback gutter for a frame before layout put
  // it back beside the content column — a sideways jump every time it came back.
  it("keeps its place in the layout while hidden, so it does not jump back in", () => {
    renderWithProviders(<ScrollToTopFab visible={false} onPress={jest.fn()} />);
    expect(screen.getByTestId("scroll-to-top-lane")).toBeTruthy();
    // Present in the layout, but gone from the a11y tree and from the press target.
    expect(screen.queryByRole("button")).toBeNull();
    // `aria-hidden` rather than the native-only accessibilityElementsHidden pair, because
    // react-native-web forwards this one and drops those — see ScrollToTopFab.tsx.
    expect(
      screen.getByTestId("scroll-to-top-fab", { includeHiddenElements: true }).props["aria-hidden"]
    ).toBe(true);
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

  describe("fabRestingBand", () => {
    // Wide enough for the gutter to hold the FAB beside the column, so the row the page ends
    // on is already clear of it and reserves nothing.
    it.each([1440, 1680, 2560])("reserves nothing at %ipx, where the FAB has a gutter", (width) => {
      expect(fabRestingBand(width)).toBe(0);
    });

    // No gutter: the FAB is over the content column, so the page's last row keeps the band it
    // rests in clear — its own inset, the FAB, and a gap above it.
    it.each([1320, 768, 390])("reserves the FAB's band at %ipx, where it has none", (width) => {
      expect(fabRestingBand(width)).toBe(FAB_MIN_GUTTER + FAB_SIZE + FAB_MIN_GUTTER);
    });

    // Same boundary the gutter itself switches on, so the reserve can never be dropped while
    // the FAB is still over the column.
    it("switches over exactly where the gutter becomes wide enough", () => {
      const tight = CONTENT_MAX_WIDTH + 2 * (FAB_SIZE + FAB_MIN_GUTTER - CONTENT_PADDING_H);
      expect(fabRestingBand(tight)).toBeGreaterThan(0);
      expect(fabRestingBand(tight + 2)).toBe(0);
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

  // The FAB used to climb over the footer, recomputing an offset on every scroll event and
  // sliding an element that reads as pinned up the page (#399). It holds one place now.
  it("rests on the same gutter whether it is showing or not", () => {
    const { unmount } = renderWithProviders(<ScrollToTopFab visible onPress={jest.fn()} />);
    const shown = StyleSheet.flatten(screen.getByTestId("scroll-to-top-lane").props.style);
    unmount();

    renderWithProviders(<ScrollToTopFab visible={false} onPress={jest.fn()} />);
    const hidden = StyleSheet.flatten(screen.getByTestId("scroll-to-top-lane").props.style);

    expect(hidden.bottom).toBe(shown.bottom);
    expect(hidden.transform).toBeUndefined();
  });

  it("takes no presses once it has faded out", () => {
    const onPress = jest.fn();
    renderWithProviders(<ScrollToTopFab visible={false} onPress={onPress} />);

    fireEvent.press(screen.getByTestId("scroll-to-top-fab", { includeHiddenElements: true }));

    expect(onPress).not.toHaveBeenCalled();
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    renderWithProviders(<ScrollToTopFab visible onPress={onPress} />);
    fireEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
