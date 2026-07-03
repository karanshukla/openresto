import { Platform } from "react-native";
import { scrollIntoView } from "@/utils/scrollIntoView";

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

    scrollIntoView(targetRef as any, scrollRef as any, "center");

    expect(domScrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  });

  it("defaults block to 'start' on web when omitted, and is a no-op when scrollIntoView is unavailable", () => {
    Platform.OS = "web";
    const targetRef = { current: {} };
    const scrollRef = { current: null };

    expect(() => scrollIntoView(targetRef as any, scrollRef as any)).not.toThrow();
  });

  it("returns early on native when findNodeHandle can't resolve a node", () => {
    Platform.OS = "ios";
    jest.spyOn(require("react-native"), "findNodeHandle").mockReturnValue(null);
    const measureLayout = jest.fn();
    const targetRef = { current: { measureLayout } };
    const scrollRef = { current: {} };

    scrollIntoView(targetRef as any, scrollRef as any);

    expect(measureLayout).not.toHaveBeenCalled();
  });

  it("measures against the scroll view and scrolls to the clamped offset on success", () => {
    Platform.OS = "android";
    jest.spyOn(require("react-native"), "findNodeHandle").mockReturnValue(42);
    const scrollTo = jest.fn();
    const measureLayout = jest.fn((_node, onSuccess, onFail) => {
      onSuccess(0, 200);
      onFail();
    });
    const targetRef = { current: { measureLayout } };
    const scrollRef = { current: { scrollTo } };

    scrollIntoView(targetRef as any, scrollRef as any);

    expect(measureLayout).toHaveBeenCalledWith(42, expect.any(Function), expect.any(Function));
    expect(scrollTo).toHaveBeenCalledWith({ y: 184, animated: true });
  });

  it("clamps negative offsets to 0 and is a no-op when the scroll ref has no current value", () => {
    Platform.OS = "android";
    jest.spyOn(require("react-native"), "findNodeHandle").mockReturnValue(42);
    const measureLayout = jest.fn((_node, onSuccess) => {
      onSuccess(0, 5);
    });
    const targetRef = { current: { measureLayout } };
    const scrollRef = { current: null };

    expect(() => scrollIntoView(targetRef as any, scrollRef as any)).not.toThrow();
  });
});
