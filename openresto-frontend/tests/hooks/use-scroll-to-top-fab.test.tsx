import { renderHook, act } from "@testing-library/react-native";
import { useScrollToTopFab } from "@/hooks/use-scroll-to-top-fab";
import { SHOW_AFTER_SCROLL_Y } from "@/components/common/ScrollToTopFab";

/** A scroll event `fromBottom` px short of the end of a page one viewport taller than its scroll. */
const scrollEvent = (y: number, fromBottom = 1000) =>
  ({
    nativeEvent: {
      contentOffset: { y },
      layoutMeasurement: { height: 900 },
      contentSize: { height: 900 + y + fromBottom },
    },
  }) as never;

describe("useScrollToTopFab", () => {
  it("stays away until the scroll is worth undoing", () => {
    const { result } = renderHook(() => useScrollToTopFab());
    expect(result.current.visible).toBe(false);

    act(() => result.current.trackScroll(scrollEvent(SHOW_AFTER_SCROLL_Y)));
    expect(result.current.visible).toBe(false);

    act(() => result.current.trackScroll(scrollEvent(SHOW_AFTER_SCROLL_Y + 1)));
    expect(result.current.visible).toBe(true);
  });

  // It used to stand down over the footer, which took the shortcut away at the bottom of the page
  // — exactly where it is most wanted (#399).
  it("holds to the very end of the scroll, where it is most wanted", () => {
    const { result } = renderHook(() => useScrollToTopFab());

    act(() => result.current.trackScroll(scrollEvent(600, 0)));

    expect(result.current.visible).toBe(true);
  });

  it("goes away again on the way back up", () => {
    const { result } = renderHook(() => useScrollToTopFab());

    act(() => result.current.trackScroll(scrollEvent(600)));
    expect(result.current.visible).toBe(true);

    act(() => result.current.trackScroll(scrollEvent(0)));
    expect(result.current.visible).toBe(false);
  });

  // The hook runs in the screen, so a render here is a render of the whole page — every card,
  // every row. react-native-web never throttles onScroll, so anything held here that tracks the
  // scroll position re-rendered the page several times a frame (#399).
  it("does not re-render the screen once per scroll event", () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useScrollToTopFab();
    });

    act(() => result.current.trackScroll(scrollEvent(600)));
    const settled = renders;

    // A gesture's worth of positions, none of which crosses the threshold.
    for (let y = 600; y < 900; y += 12) {
      act(() => result.current.trackScroll(scrollEvent(y)));
    }

    expect(result.current.visible).toBe(true);
    // React may still render once more before bailing on an unchanged value; what must not happen
    // is a render for each of the twenty-five positions.
    expect(renders).toBeLessThanOrEqual(settled + 1);
  });

  it("hands the ScrollView the same handler across renders", () => {
    const { result, rerender } = renderHook(() => useScrollToTopFab());
    const first = result.current.trackScroll;

    rerender({});

    expect(result.current.trackScroll).toBe(first);
  });
});
