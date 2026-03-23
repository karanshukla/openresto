import { renderHook, act } from "@testing-library/react-native";
import { useTableHold } from "@/components/booking/useTableHold";

const mockCreateHold = jest.fn();
const mockReleaseHold = jest.fn();

jest.mock("@/api/holds", () => ({
  createHold: (...args: unknown[]) => mockCreateHold(...args),
  releaseHold: (...args: unknown[]) => mockReleaseHold(...args),
}));

beforeEach(() => {
  mockCreateHold.mockReset();
  mockReleaseHold.mockReset();
  jest.useFakeTimers();
  jest.spyOn(console, "error").mockImplementation();
});

afterEach(() => {
  jest.useRealTimers();
});

const defaultParams = {
  restaurantId: 1,
  sections: [{ id: 10, tables: [{ id: 100 }] }],
  tableId: undefined as number | undefined,
  date: "2026-06-15",
  time: "19:00",
};

describe("useTableHold", () => {
  it("starts with idle status", () => {
    const { result } = renderHook(() => useTableHold(defaultParams));

    expect(result.current.holdStatus).toBe("idle");
    expect(result.current.hold).toBeNull();
    expect(result.current.secondsLeft).toBe(0);
  });

  it("remains idle when tableId is undefined", () => {
    const { result } = renderHook(() => useTableHold(defaultParams));

    // Advance past debounce
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.holdStatus).toBe("idle");
    expect(mockCreateHold).not.toHaveBeenCalled();
  });

  it("transitions to pending then held after debounce when tableId is set", async () => {
    const expiresAt = new Date(Date.now() + 120_000).toISOString();
    mockCreateHold.mockResolvedValueOnce({
      holdId: "hold-1",
      expiresAt,
      secondsRemaining: 120,
    });

    const params = { ...defaultParams, tableId: 100 };
    const { result } = renderHook(() => useTableHold(params));

    // Should be pending before debounce fires
    expect(result.current.holdStatus).toBe("pending");

    // Advance past the 2000ms debounce
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(mockCreateHold).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: 1,
        tableId: 100,
        sectionId: 10,
      })
    );
    expect(result.current.holdStatus).toBe("held");
    expect(result.current.hold).not.toBeNull();
    expect(result.current.hold?.holdId).toBe("hold-1");
  });

  it("sets unavailable status when createHold returns null", async () => {
    mockCreateHold.mockResolvedValueOnce(null);

    const params = { ...defaultParams, tableId: 100 };
    const { result } = renderHook(() => useTableHold(params));

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.holdStatus).toBe("unavailable");
  });

  it("countdown decreases secondsLeft and expires to idle", async () => {
    // Hold expires in 3 seconds for fast test
    const expiresAt = new Date(Date.now() + 3_000).toISOString();
    mockCreateHold.mockResolvedValueOnce({
      holdId: "hold-2",
      expiresAt,
      secondsRemaining: 3,
    });

    const params = { ...defaultParams, tableId: 100 };
    const { result } = renderHook(() => useTableHold(params));

    await act(async () => {
      jest.advanceTimersByTime(2000); // debounce
    });

    expect(result.current.holdStatus).toBe("held");
    expect(result.current.secondsLeft).toBeGreaterThanOrEqual(0);

    // Advance past expiry
    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(result.current.holdStatus).toBe("expired");
    expect(result.current.hold).toBeNull();
  });

  it("releases hold on unmount", async () => {
    mockCreateHold.mockResolvedValueOnce({
      holdId: "hold-cleanup",
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
      secondsRemaining: 120,
    });

    const params = { ...defaultParams, tableId: 100 };
    const { result, unmount } = renderHook(() => useTableHold(params));

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.holdStatus).toBe("held");

    unmount();

    expect(mockReleaseHold).toHaveBeenCalledWith("hold-cleanup");
  });

  it("releaseCurrentHold resets state and calls releaseHold", async () => {
    mockCreateHold.mockResolvedValueOnce({
      holdId: "hold-manual",
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
      secondsRemaining: 120,
    });

    const params = { ...defaultParams, tableId: 100 };
    const { result } = renderHook(() => useTableHold(params));

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.holdStatus).toBe("held");

    act(() => {
      result.current.releaseCurrentHold();
    });

    expect(mockReleaseHold).toHaveBeenCalledWith("hold-manual");
    expect(result.current.holdStatus).toBe("idle");
    expect(result.current.hold).toBeNull();
  });
});
