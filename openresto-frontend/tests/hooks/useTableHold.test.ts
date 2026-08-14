import { renderHook, act } from "@testing-library/react-native";
import { useTableHold, UseTableHoldParams } from "@/components/booking/useTableHold";

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
  email: "test@example.com",
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
      ok: true,
      hold: {
        holdId: "hold-1",
        expiresAt,
        secondsRemaining: 120,
      },
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

  it("sets unavailable status when createHold fails", async () => {
    mockCreateHold.mockResolvedValueOnce({
      ok: false,
      message: "Cannot hold a table for a past time.",
    });

    const params = { ...defaultParams, tableId: 100 };
    const { result } = renderHook(() => useTableHold(params));

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.holdStatus).toBe("unavailable");
    expect(result.current.holdMessage).toBe("Cannot hold a table for a past time.");
  });

  it("countdown decreases secondsLeft and expires to idle", async () => {
    // Hold expires in 3 seconds for fast test
    const expiresAt = new Date(Date.now() + 3_000).toISOString();
    mockCreateHold.mockResolvedValueOnce({
      ok: true,
      hold: {
        holdId: "hold-2",
        expiresAt,
        secondsRemaining: 3,
      },
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
      ok: true,
      hold: {
        holdId: "hold-cleanup",
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
        secondsRemaining: 120,
      },
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

  // ── Seating changes drop the hold they invalidated (#316) ──────────────────
  //
  // The seating pick reaches this hook only as params, so these cover the whole contract that
  // BookingForm used to enforce with an explicit releaseCurrentHold() call: a pick that stops
  // being holdable releases outright, and a pick that resolves elsewhere is replaced atomically.

  it("releases the hold when the seating pick is cleared", async () => {
    mockCreateHold.mockResolvedValueOnce({
      ok: true,
      hold: {
        holdId: "hold-manual",
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
        secondsRemaining: 120,
      },
    });

    const { result, rerender } = renderHook((props: UseTableHoldParams) => useTableHold(props), {
      initialProps: { ...defaultParams, tableId: 100 },
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.holdStatus).toBe("held");

    // Switching to a section with no fitting table leaves the form with no pick at all.
    rerender({ ...defaultParams, tableId: undefined });

    expect(mockReleaseHold).toHaveBeenCalledWith("hold-manual");
    expect(result.current.holdStatus).toBe("idle");
    expect(result.current.hold).toBeNull();
    expect(result.current.holdId).toBeNull();
  });

  it("keeps the hold when a param outside the held unit changes", async () => {
    mockCreateHold.mockResolvedValueOnce({
      ok: true,
      hold: {
        holdId: "hold-kept",
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
        secondsRemaining: 120,
      },
    });

    const { result, rerender } = renderHook((props: UseTableHoldParams) => useTableHold(props), {
      initialProps: { ...defaultParams, tableId: 100 },
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.holdStatus).toBe("held");

    // The email is a trigger for the effect but not part of the held unit, so correcting a typo
    // must not churn a hold that is still valid.
    rerender({ ...defaultParams, tableId: 100, email: "corrected@example.com" });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.holdStatus).toBe("held");
    expect(result.current.hold?.holdId).toBe("hold-kept");
    expect(mockCreateHold).toHaveBeenCalledTimes(1);
    expect(mockReleaseHold).not.toHaveBeenCalled();
  });

  it("replaces the hold when the seating pick moves to another table", async () => {
    mockCreateHold.mockResolvedValueOnce({
      ok: true,
      hold: {
        holdId: "hold-table-100",
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
        secondsRemaining: 120,
      },
    });

    const sections = [
      { id: 10, tables: [{ id: 100 }] },
      { id: 20, tables: [{ id: 200 }] },
    ];
    const { result, rerender } = renderHook((props: UseTableHoldParams) => useTableHold(props), {
      initialProps: { ...defaultParams, sections, tableId: 100 },
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.holdStatus).toBe("held");

    mockCreateHold.mockResolvedValueOnce({
      ok: true,
      hold: {
        holdId: "hold-table-200",
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
        secondsRemaining: 120,
      },
    });

    // Picking a table in another section: the old hold stops standing the moment the pick changes.
    rerender({ ...defaultParams, sections, tableId: 200 });
    expect(result.current.holdStatus).toBe("pending");

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(mockCreateHold).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ tableId: 200, sectionId: 20, currentHoldId: "hold-table-100" })
    );
    expect(result.current.hold?.holdId).toBe("hold-table-200");
  });

  it("replaces a table hold when the pick switches to a combinable group", async () => {
    mockCreateHold.mockResolvedValueOnce({
      ok: true,
      hold: {
        holdId: "hold-table",
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
        secondsRemaining: 120,
      },
    });

    const { result, rerender } = renderHook((props: UseTableHoldParams) => useTableHold(props), {
      initialProps: { ...defaultParams, tableId: 100, seats: 4 },
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.holdStatus).toBe("held");

    mockCreateHold.mockResolvedValueOnce({
      ok: true,
      hold: {
        holdId: "hold-group",
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
        secondsRemaining: 120,
        tableGroupId: 5,
      },
    });

    // tableId and tableGroupId are mutually exclusive in the dropdown, so the group pick arrives
    // with the table cleared.
    rerender({ ...defaultParams, tableId: undefined, tableGroupId: 5, seats: 4 });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(mockCreateHold).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        tableId: null,
        sectionId: null,
        tableGroupId: 5,
        seats: 4,
        currentHoldId: "hold-table",
      })
    );
    expect(result.current.resolvedGroupId).toBe(5);
  });

  it("re-triggers hold when date changes, passing currentHoldId for atomic replace", async () => {
    mockCreateHold.mockResolvedValueOnce({
      ok: true,
      hold: {
        holdId: "hold-date-1",
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
        secondsRemaining: 120,
      },
    });

    const { result, rerender } = renderHook((props: UseTableHoldParams) => useTableHold(props), {
      initialProps: { ...defaultParams, tableId: 100 },
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.holdStatus).toBe("held");
    expect(mockCreateHold).toHaveBeenCalledTimes(1);

    // Change date
    const newProps = { ...defaultParams, tableId: 100, date: "2026-06-16" };

    mockCreateHold.mockResolvedValueOnce({
      ok: true,
      hold: {
        holdId: "hold-date-2",
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
        secondsRemaining: 120,
      },
    });

    rerender(newProps);

    expect(result.current.holdStatus).toBe("pending");

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    // Backend handles the release atomically — no explicit releaseHold call on success
    expect(mockReleaseHold).not.toHaveBeenCalled();
    // currentHoldId forwarded so backend can replace atomically
    expect(mockCreateHold).toHaveBeenCalledTimes(2);
    expect(mockCreateHold).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ currentHoldId: "hold-date-1" })
    );
    expect(result.current.hold?.holdId).toBe("hold-date-2");
  });

  it("releases previous hold explicitly when createHold fails", async () => {
    mockCreateHold.mockResolvedValueOnce({
      ok: true,
      hold: {
        holdId: "hold-fail-1",
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
        secondsRemaining: 120,
      },
    });

    const { result, rerender } = renderHook((props: UseTableHoldParams) => useTableHold(props), {
      initialProps: { ...defaultParams, tableId: 100 },
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.holdStatus).toBe("held");

    // Second attempt fails — table taken by someone else
    mockCreateHold.mockResolvedValueOnce({
      ok: false,
      message: "This table is already held by another user.",
    });
    rerender({ ...defaultParams, tableId: 100, date: "2026-06-16" });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    // Previous hold must be explicitly released since backend didn't consume it
    expect(mockReleaseHold).toHaveBeenCalledWith("hold-fail-1");
    expect(result.current.holdStatus).toBe("unavailable");
    expect(result.current.hold).toBeNull();
  });

  // ── Auto-assign ("Any section") mode ───────────────────────────────────────

  it("auto-assign mode fires hold without a tableId and adopts the server-resolved table", async () => {
    mockCreateHold.mockResolvedValueOnce({
      ok: true,
      hold: {
        holdId: "auto-hold-1",
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
        secondsRemaining: 120,
        tableId: 42, // server-resolved
        sectionId: 7,
      },
    });

    // autoAssign + seats; tableId left undefined.
    const params: UseTableHoldParams = {
      ...defaultParams,
      autoAssign: true,
      seats: 2,
    };
    const { result } = renderHook(() => useTableHold(params));

    expect(result.current.holdStatus).toBe("pending");

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    // Must send null table/section + seats so the server picks the table.
    expect(mockCreateHold).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: 1,
        tableId: null,
        sectionId: null,
        seats: 2,
      })
    );
    expect(result.current.holdStatus).toBe("held");
    expect(result.current.resolvedTableId).toBe(42);
    expect(result.current.resolvedSectionId).toBe(7);
  });

  it("auto-assign mode surfaces unavailable when server rejects", async () => {
    mockCreateHold.mockResolvedValueOnce({
      ok: false,
      message: "No tables are available for the requested time and party size.",
    });

    const params: UseTableHoldParams = {
      ...defaultParams,
      autoAssign: true,
      seats: 99,
    };
    const { result } = renderHook(() => useTableHold(params));

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.holdStatus).toBe("unavailable");
    expect(result.current.resolvedTableId).toBeNull();
    expect(result.current.resolvedSectionId).toBeNull();
  });
});
