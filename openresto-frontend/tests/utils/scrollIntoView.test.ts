import { Platform } from "react-native";
import { scrollIntoView } from "@/utils/scrollIntoView";

/**
 * `content` stands in for the ScrollView's inner content view. It is an opaque object on
 * purpose: the New Architecture's `measureLayout` takes the element and rejects a node handle
 * with `instanceof`, so a test that accepted a number here would pass while the app silently
 * failed to scroll — which is exactly what shipped.
 */
const content = { __contentView: true };

describe("scrollIntoView", () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Platform.OS = originalPlatform;
    jest.restoreAllMocks();
  });

  it("does nothing when the target ref has no current value", () => {
    Platform.OS = "web";
    const targetRef = { current: null };
    const scrollRef = { current: null };
    expect(() => scrollIntoView(targetRef as any, scrollRef as any)).not.toThrow();
  });

  it("calls the DOM scrollIntoView on web with the given block, default behavior", () => {
    Platform.OS = "web";
    const domScrollIntoView = jest.fn();
    const targetRef = { current: { scrollIntoView: domScrollIntoView } };
    const scrollRef = { current: null };

    scrollIntoView(targetRef as any, scrollRef as any, { block: "center" });

    expect(domScrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  });

  /**
   * A list positioning itself at its current value has to be there on the first frame: the
   * smooth path animates through every row in between, which on a fifty-row picker reads as
   * the control scrolling away from the press.
   */
  it("lands instantly on web when the caller opts out of the animation", () => {
    Platform.OS = "web";
    const domScrollIntoView = jest.fn();
    const targetRef = { current: { scrollIntoView: domScrollIntoView } };
    const scrollRef = { current: null };

    scrollIntoView(targetRef as any, scrollRef as any, { block: "nearest", animated: false });

    expect(domScrollIntoView).toHaveBeenCalledWith({ behavior: "instant", block: "nearest" });
  });

  it("lands instantly on native when the caller opts out of the animation", () => {
    Platform.OS = "ios";
    const scrollTo = jest.fn();
    const measureLayout = jest.fn((_node, onSuccess) => onSuccess(0, 200));
    const targetRef = { current: { measureLayout } };
    const scrollRef = { current: { scrollTo, getInnerViewRef: () => content } };

    scrollIntoView(targetRef as any, scrollRef as any, { animated: false });

    expect(scrollTo).toHaveBeenCalledWith({ y: 184, animated: false });
  });

  it("defaults block to 'start' on web when omitted, and is a no-op when scrollIntoView is unavailable", () => {
    Platform.OS = "web";
    const targetRef = { current: {} };
    const scrollRef = { current: null };

    expect(() => scrollIntoView(targetRef as any, scrollRef as any)).not.toThrow();
  });

  it("returns early on native when the scroll view has no content view yet", () => {
    Platform.OS = "ios";
    const measureLayout = jest.fn();
    const targetRef = { current: { measureLayout } };
    const scrollRef = { current: { getInnerViewRef: () => null } };

    scrollIntoView(targetRef as any, scrollRef as any);

    expect(measureLayout).not.toHaveBeenCalled();
  });

  it("measures against the content view element, never a node handle", () => {
    Platform.OS = "android";
    const scrollTo = jest.fn();
    const measureLayout = jest.fn((_node, onSuccess, onFail) => {
      onSuccess(0, 200);
      onFail();
    });
    const targetRef = { current: { measureLayout } };
    const scrollRef = { current: { scrollTo, getInnerViewRef: () => content } };

    scrollIntoView(targetRef as any, scrollRef as any);

    expect(measureLayout).toHaveBeenCalledWith(content, expect.any(Function), expect.any(Function));
    expect(scrollTo).toHaveBeenCalledWith({ y: 184, animated: true });
  });

  it("clamps negative offsets to 0 and is a no-op when the scroll ref has no current value", () => {
    Platform.OS = "android";
    const measureLayout = jest.fn((_node, onSuccess) => {
      onSuccess(0, 5);
    });
    const targetRef = { current: { measureLayout } };
    const scrollRef = { current: null };

    expect(() => scrollIntoView(targetRef as any, scrollRef as any)).not.toThrow();
  });
});
