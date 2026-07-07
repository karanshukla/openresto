import { renderHook, act } from "@testing-library/react-native";
import { useConfirm } from "@/hooks/use-confirm";

describe("useConfirm", () => {
  it("starts with null state", () => {
    const { result } = renderHook(() => useConfirm());
    expect(result.current.state).toBeNull();
  });

  it("confirm() sets the message + returns a promise that resolves on handleConfirm", async () => {
    const { result } = renderHook(() => useConfirm());
    let resolved: boolean | undefined;
    act(() => {
      result.current.confirm("Delete this?").then((v) => {
        resolved = v;
      });
    });
    expect(result.current.state?.message).toBe("Delete this?");
    expect(resolved).toBeUndefined();
    await act(async () => {
      result.current.handleConfirm();
      // Flush the promise microtask before asserting.
      await Promise.resolve();
    });
    expect(resolved).toBe(true);
    expect(result.current.state).toBeNull();
  });

  it("handleCancel resolves the promise with false", async () => {
    const { result } = renderHook(() => useConfirm());
    let resolved: boolean | undefined;
    act(() => {
      result.current.confirm("Sure?").then((v) => {
        resolved = v;
      });
    });
    await act(async () => {
      result.current.handleCancel();
      await Promise.resolve();
    });
    expect(resolved).toBe(false);
    expect(result.current.state).toBeNull();
  });

  it("clears state so a second confirm can be issued", () => {
    const { result } = renderHook(() => useConfirm());
    act(() => {
      void result.current.confirm("first");
    });
    expect(result.current.state?.message).toBe("first");
    act(() => {
      result.current.handleConfirm();
    });
    act(() => {
      void result.current.confirm("second");
    });
    expect(result.current.state?.message).toBe("second");
  });
});
