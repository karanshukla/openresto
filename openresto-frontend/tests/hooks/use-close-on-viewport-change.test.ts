/**
 * @jest-environment jsdom
 */
import { renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";
import { useCloseOnViewportChange } from "@/hooks/use-close-on-viewport-change";

describe("useCloseOnViewportChange", () => {
  const originalOS = Platform.OS;
  const setOS = (value: string) =>
    Object.defineProperty(Platform, "OS", { value, configurable: true });

  beforeEach(() => setOS("web"));
  afterEach(() => setOS(originalOS));

  it("closes when the window is resized", () => {
    const onClose = jest.fn();
    renderHook(() => useCloseOnViewportChange(true, onClose));

    window.dispatchEvent(new Event("resize"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /**
   * The boundary that matters, and the one an earlier cut got wrong. Closing on scroll looks
   * like the same staleness problem, but the backdrop stops anything behind the panel scrolling,
   * so the only scroll reachable while it is open comes from the option list inside it —
   * dismissing the list as the user scrolls toward their option, and taking three booking E2Es
   * with it.
   */
  it("ignores scrolling, which while open can only be the list itself", () => {
    const onClose = jest.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    renderHook(() => useCloseOnViewportChange(true, onClose));

    container.dispatchEvent(new Event("scroll", { bubbles: true }));
    window.dispatchEvent(new Event("scroll"));

    expect(onClose).not.toHaveBeenCalled();
    container.remove();
  });

  it("stays out of the way while inactive", () => {
    const onClose = jest.fn();
    renderHook(() => useCloseOnViewportChange(false, onClose));

    window.dispatchEvent(new Event("resize"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("unsubscribes on unmount", () => {
    const onClose = jest.fn();
    const { unmount } = renderHook(() => useCloseOnViewportChange(true, onClose));

    unmount();
    window.dispatchEvent(new Event("resize"));

    expect(onClose).not.toHaveBeenCalled();
  });

  /** Native has no viewport to move and no window listeners to attach. */
  it("does nothing on native", () => {
    setOS("ios");
    const onClose = jest.fn();
    renderHook(() => useCloseOnViewportChange(true, onClose));

    window.dispatchEvent(new Event("resize"));

    expect(onClose).not.toHaveBeenCalled();
  });
});
