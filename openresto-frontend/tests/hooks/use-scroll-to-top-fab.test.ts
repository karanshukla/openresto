import { renderHook, act } from "@testing-library/react-native";
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

  it("lifts the FAB by the footer it measured, not by a guess", () => {
    const { result } = renderHook(() => useScrollToTopFab());

    act(() => result.current.measureFooter(layoutEvent(FOOTER_HEIGHT)));
    act(() => result.current.trackScroll(scrollEvent(600, 1000)));
    expect(result.current.lift).toBe(0);

    act(() => result.current.trackScroll(scrollEvent(600, 0)));
    expect(result.current.lift).toBe(FOOTER_HEIGHT);
  });

  // A screen that takes the footer back out of its scroll — Locations, once the booking
  // drawer opens — hands the FAB nothing to climb over.
  it("drops the lift when the footer leaves the scroll", () => {
    const { result } = renderHook(() => useScrollToTopFab());

    act(() => result.current.measureFooter(layoutEvent(FOOTER_HEIGHT)));
    act(() => result.current.trackScroll(scrollEvent(600, 0)));
    expect(result.current.lift).toBe(FOOTER_HEIGHT);

    act(() => result.current.setFooterHeight(0));
    act(() => result.current.trackScroll(scrollEvent(600, 0)));
    expect(result.current.lift).toBe(0);
  });
});
