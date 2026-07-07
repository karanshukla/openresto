import { renderHook, act } from "@testing-library/react-native";
import { useErrorHandler } from "@/hooks/useErrorHandler";

describe("useErrorHandler", () => {
  it("starts with errorMessage null", () => {
    const { result } = renderHook(() => useErrorHandler());
    expect(result.current.errorMessage).toBeNull();
  });

  it("showError(Error) sets message to the error's message", () => {
    const { result } = renderHook(() => useErrorHandler());
    act(() => result.current.showError(new Error("boom")));
    expect(result.current.errorMessage).toBe("boom");
  });

  it("showError(string) sets message to the string", () => {
    const { result } = renderHook(() => useErrorHandler());
    act(() => result.current.showError("a plain string"));
    expect(result.current.errorMessage).toBe("a plain string");
  });

  it("showError(unknown) sets message to String(unknown)", () => {
    const { result } = renderHook(() => useErrorHandler());
    act(() => result.current.showError({ weird: "value" }));
    expect(result.current.errorMessage).toBe(String({ weird: "value" }));
    act(() => result.current.showError(42));
    expect(result.current.errorMessage).toBe("42");
    act(() => result.current.showError(null));
    expect(result.current.errorMessage).toBe(String(null));
  });

  it("clearError resets errorMessage to null", () => {
    const { result } = renderHook(() => useErrorHandler());
    act(() => result.current.showError(new Error("temp")));
    expect(result.current.errorMessage).toBe("temp");
    act(() => result.current.clearError());
    expect(result.current.errorMessage).toBeNull();
  });

  it("showError identity is stable across renders (useCallback)", () => {
    const { result, rerender } = renderHook(() => useErrorHandler());
    const first = result.current.showError;
    rerender({});
    expect(result.current.showError).toBe(first);
  });
});
