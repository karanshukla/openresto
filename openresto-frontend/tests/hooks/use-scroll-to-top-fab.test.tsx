import { renderHook as renderHookRaw, act } from "@testing-library/react-native";
import type { Animated } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import React from "react";
import { fabLift, useScrollToTopFab } from "@/hooks/use-scroll-to-top-fab";
import { SHOW_AFTER_SCROLL_Y } from "@/components/common/ScrollToTopFab";

const FOOTER_HEIGHT = 88;

/** A scroll event `fromBottom` px short of the end of a page one viewport taller than its scroll. */
const scrollEvent = (y: number, fromBottom = 1000) =>
  ({
    nativeEvent: {
      contentOffset: { y },
      layoutMeasurement: { height: 900 },
      contentSize: { height: 900 + y + fromBottom },
    },
  }) as never;

const layoutEvent = (height: number) =>
  ({ nativeEvent: { layout: { height, width: 1280, x: 0, y: 0 } } }) as never;

/** The hook reads the safe-area inset the FAB already rests on, so it needs the provider. */
const ZERO_INSETS = {
  frame: { x: 0, y: 0, width: 1280, height: 900 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const renderHook = <T,>(cb: () => T) =>
  renderHookRaw(cb, {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(SafeAreaProvider, { initialMetrics: ZERO_INSETS }, children),
  });

/** The rise the FAB is currently being held at, read off the Animated.Value driving it. */
const riseOf = (travel: Animated.Value): number => (travel as unknown as { _value: number })._value;

describe("fabLift", () => {
  // The FAB used to sit in its container's bottom corner whatever was under it, so at the
  // end of a scroll it came to rest on the footer's own links (#352 follow-up).
  it("stays flat while the footer is still below the fold", () => {
    expect(fabLift(FOOTER_HEIGHT, FOOTER_HEIGHT + 1)).toBe(0);
    expect(fabLift(FOOTER_HEIGHT, 1000)).toBe(0);
  });

  it("rises with the footer once it starts entering the viewport", () => {
    expect(fabLift(FOOTER_HEIGHT, FOOTER_HEIGHT - 1)).toBe(1);
    expect(fabLift(FOOTER_HEIGHT, 20)).toBe(FOOTER_HEIGHT - 20);
  });

  // At the very bottom the whole footer is on screen, so the FAB rests on its top edge.
  it("clears the whole footer at the end of the scroll", () => {
    expect(fabLift(FOOTER_HEIGHT, 0)).toBe(FOOTER_HEIGHT);
  });

  // Overscroll on iOS reports a negative distance; the FAB must not chase it up the page.
  it("does not keep climbing past the footer when the scroll overshoots", () => {
    expect(fabLift(FOOTER_HEIGHT, -60)).toBe(FOOTER_HEIGHT);
    expect(fabLift(0, -60)).toBe(0);
  });
});

describe("useScrollToTopFab", () => {
  it("shows the FAB only once the scroll is worth undoing", () => {
    const { result } = renderHook(() => useScrollToTopFab());
    expect(result.current.visible).toBe(false);

    act(() => result.current.trackScroll(scrollEvent(SHOW_AFTER_SCROLL_Y)));
    expect(result.current.visible).toBe(false);

    act(() => result.current.trackScroll(scrollEvent(SHOW_AFTER_SCROLL_Y + 1)));
    expect(result.current.visible).toBe(true);
  });

  // The hook runs in the screen, so a render here is a render of the whole page — every card,
  // every row. The rise changes on every scroll event for the length of the footer, and
  // react-native-web never throttles onScroll, so driving it through state re-rendered the page
  // several times a frame at the one moment the user is watching something move.
  it("does not re-render the screen once per scroll event", () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useScrollToTopFab();
    });

    act(() => result.current.measureFooter(layoutEvent(FOOTER_HEIGHT)));
    act(() => result.current.trackScroll(scrollEvent(600, 1000)));
    const settled = renders;

    // A gesture's worth of positions, all with the FAB already shown and only the rise moving.
    for (let fromBottom = FOOTER_HEIGHT; fromBottom >= 0; fromBottom -= 4) {
      act(() => result.current.trackScroll(scrollEvent(600, fromBottom)));
    }

    expect(riseOf(result.current.travel)).toBe(FOOTER_HEIGHT);
    // React may still render once more before bailing on an unchanged `visible`; what must not
    // happen is a render for each of the twenty-odd positions.
    expect(renders).toBeLessThanOrEqual(settled + 1);
  });

  it("hands the ScrollView the same handler across renders", () => {
    const { result, rerender } = renderHook(() => useScrollToTopFab());
    const first = result.current.trackScroll;

    rerender({});

    expect(result.current.trackScroll).toBe(first);
  });

  it("lifts the FAB by the footer it measured, not by a guess", () => {
    const { result } = renderHook(() => useScrollToTopFab());

    act(() => result.current.measureFooter(layoutEvent(FOOTER_HEIGHT)));
    act(() => result.current.trackScroll(scrollEvent(600, 1000)));
    expect(riseOf(result.current.travel)).toBe(0);

    act(() => result.current.trackScroll(scrollEvent(600, 0)));
    expect(riseOf(result.current.travel)).toBe(FOOTER_HEIGHT);
  });

  // A screen that takes the footer back out of its scroll — Locations, once the booking
  // drawer opens — hands the FAB nothing to climb over.
  it("drops the lift when the footer leaves the scroll", () => {
    const { result } = renderHook(() => useScrollToTopFab());

    act(() => result.current.measureFooter(layoutEvent(FOOTER_HEIGHT)));
    act(() => result.current.trackScroll(scrollEvent(600, 0)));
    expect(riseOf(result.current.travel)).toBe(FOOTER_HEIGHT);

    act(() => result.current.setFooterHeight(0));
    act(() => result.current.trackScroll(scrollEvent(600, 0)));
    expect(riseOf(result.current.travel)).toBe(0);
  });
});
