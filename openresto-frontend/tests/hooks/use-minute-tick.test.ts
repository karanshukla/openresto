import { act, renderHook } from "@testing-library/react-native";
import { useMinuteTick } from "@/hooks/use-minute-tick";

describe("useMinuteTick", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts at 0", () => {
    const { result } = renderHook(() => useMinuteTick());

    expect(result.current).toBe(0);
  });

  it("advances once a minute has elapsed", () => {
    const { result } = renderHook(() => useMinuteTick());

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(result.current).toBe(1);
  });

  it("clears its interval on unmount", () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");
    const { unmount } = renderHook(() => useMinuteTick());

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });
});
