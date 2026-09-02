/**
 * @jest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react-native";
import { Platform, type View } from "react-native";
import { useAnchorTracking } from "@/hooks/use-anchor-tracking";
import { PANEL_GAP } from "@/utils/anchoredPanel";

const originalOS = Platform.OS;
const setOS = (value: string) =>
  Object.defineProperty(Platform, "OS", { value, configurable: true });

/** A trigger that reports a box, the way a real DOM node does on web. */
const triggerAt = (top: number) => {
  const node = {
    getBoundingClientRect: () => ({ top, bottom: top + 40, left: 100, width: 240 }),
  };
  return { current: node as unknown as View };
};

/** Runs the animation frame the listeners schedule, so the re-measure actually lands. */
const flushFrame = () =>
  act(() => {
    jest.advanceTimersByTime(20);
  });

describe("useAnchorTracking", () => {
  beforeEach(() => {
    setOS("web");
    jest.useFakeTimers();
    // jsdom has no rAF loop of its own under fake timers.
    jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb) => setTimeout(() => cb(0), 0) as unknown as number);
    jest
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation((id) => clearTimeout(id as unknown as NodeJS.Timeout));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    setOS(originalOS);
  });

  it("stays unmeasured until asked, so nothing is anchored before it opens", () => {
    const { result } = renderHook(() => useAnchorTracking(triggerAt(100)));

    expect(result.current.panel).toBeNull();
  });

  it("measures the trigger on demand", () => {
    const { result } = renderHook(() => useAnchorTracking(triggerAt(100)));

    act(() => result.current.measure());

    expect(result.current.panel?.top).toBe(140 + PANEL_GAP);
  });

  /**
   * The gap this hook exists to close: a panel placed from a one-off measurement is correct only
   * until its anchor moves. Its predecessor closed the panel on a resize instead, and did not
   * notice a scroll at all.
   */
  it("follows the trigger when the page scrolls under it", () => {
    let top = 100;
    const ref = {
      current: { getBoundingClientRect: () => ({ top, bottom: top + 40, left: 100, width: 240 }) },
    };
    const { result } = renderHook(() => useAnchorTracking(ref as unknown as { current: View }));

    act(() => result.current.measure());
    top = 40;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    flushFrame();

    expect(result.current.panel?.top).toBe(80 + PANEL_GAP);
  });

  it("follows the trigger when the window is resized under it", () => {
    let top = 100;
    const ref = {
      current: { getBoundingClientRect: () => ({ top, bottom: top + 40, left: 100, width: 240 }) },
    };
    const { result } = renderHook(() => useAnchorTracking(ref as unknown as { current: View }));

    act(() => result.current.measure());
    top = 300;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    flushFrame();

    expect(result.current.panel?.top).toBe(340 + PANEL_GAP);
  });

  /**
   * The scroll listener is in the capture phase, so it also hears the option list scrolling
   * inside the panel — where the trigger has not moved at all. Without this the panel would
   * re-render on every frame of a list scroll.
   */
  it("does not re-render when a scroll leaves the trigger where it was", () => {
    const { result } = renderHook(() => useAnchorTracking(triggerAt(100)));

    act(() => result.current.measure());
    const before = result.current.panel;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    flushFrame();

    expect(result.current.panel).toBe(before);
  });

  /**
   * A trigger that stops reporting a box mid-interaction is nearly always transient. Falling
   * back to the centred sheet there would visibly tear the open panel off its control.
   */
  it("keeps the last position when the trigger stops reporting a box", () => {
    const ref: { current: unknown } = {
      current: { getBoundingClientRect: () => ({ top: 100, bottom: 140, left: 100, width: 240 }) },
    };
    const { result } = renderHook(() => useAnchorTracking(ref as { current: View }));

    act(() => result.current.measure());
    const before = result.current.panel;
    ref.current = null;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    flushFrame();

    expect(result.current.panel).toBe(before);
  });

  it("stops tracking once released", () => {
    const { result } = renderHook(() => useAnchorTracking(triggerAt(100)));

    act(() => result.current.measure());
    act(() => result.current.release());

    expect(result.current.panel).toBeNull();
  });

  /** Scroll fires far faster than a frame; coalescing is what keeps the re-measure to one a frame. */
  it("coalesces a burst of scrolls into one re-measure", () => {
    const raf = window.requestAnimationFrame as jest.Mock;
    const { result } = renderHook(() => useAnchorTracking(triggerAt(100)));

    act(() => result.current.measure());
    raf.mockClear();
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("scroll"));
    });

    expect(raf).toHaveBeenCalledTimes(1);
    flushFrame();
  });

  /** A frame still queued when the popup goes away would re-measure a trigger that has gone. */
  it("drops a queued re-measure on unmount", () => {
    const cancel = jest.spyOn(window, "cancelAnimationFrame");
    const { result, unmount } = renderHook(() => useAnchorTracking(triggerAt(100)));

    act(() => result.current.measure());
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    unmount();

    expect(cancel).toHaveBeenCalled();
  });

  it("unsubscribes on unmount", () => {
    const remove = jest.spyOn(window, "removeEventListener");
    const { result, unmount } = renderHook(() => useAnchorTracking(triggerAt(100)));

    act(() => result.current.measure());
    unmount();

    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function), true);
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
  });

  /**
   * Native has no `getBoundingClientRect`; it asks the view and is called back. The panel has
   * to land in the same place either way, so both platforms go through `anchorPanel` and only
   * the reading of the box differs.
   */
  describe("on native", () => {
    /** A trigger that reports a box the way a real host view does. */
    const nativeTriggerAt = (top: number) => {
      const node = {
        measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) =>
          cb(100, top, 240, 40),
      };
      return { current: node as unknown as View };
    };

    it("anchors to the trigger instead of falling back to the centred sheet", () => {
      setOS("ios");
      const { result } = renderHook(() => useAnchorTracking(nativeTriggerAt(100)));

      act(() => result.current.measure());

      expect(result.current.panel).not.toBeNull();
      expect(result.current.panel?.top).toBe(100 + 40 + PANEL_GAP);
    });

    it("keeps the centred sheet for a trigger that reports no box", () => {
      setOS("android");
      const node = {
        measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) =>
          cb(0, 0, 0, 0),
      };

      const { result } = renderHook(() => useAnchorTracking({ current: node as unknown as View }));
      act(() => result.current.measure());

      expect(result.current.panel).toBeNull();
    });

    it("subscribes to nothing: there is no window scroll to follow", () => {
      setOS("ios");
      const add = jest.spyOn(window, "addEventListener");
      const { result } = renderHook(() => useAnchorTracking(nativeTriggerAt(100)));

      act(() => result.current.measure());

      expect(add).not.toHaveBeenCalledWith("scroll", expect.any(Function), true);
    });
  });
});
