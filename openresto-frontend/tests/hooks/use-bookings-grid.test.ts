import { renderHook, act } from "@testing-library/react-native";
import { useBookingsGrid } from "@/hooks/use-bookings-grid";

const mockAdminGetTables = jest.fn();
const mockGetAdminBookings = jest.fn();

jest.mock("@/api/admin", () => ({
  adminGetTables: (...args: unknown[]) => mockAdminGetTables(...args),
  getAdminBookings: (...args: unknown[]) => mockGetAdminBookings(...args),
}));

const SECTIONS = [{ id: 1, name: "Main", tables: [{ id: 10, name: "T1" }] }];
const BOOKINGS = [{ id: 100, customerName: "Alice" }];

beforeEach(() => {
  mockAdminGetTables.mockReset();
  mockGetAdminBookings.mockReset();
  mockAdminGetTables.mockResolvedValue(SECTIONS);
  mockGetAdminBookings.mockResolvedValue(BOOKINGS);
});

describe("useBookingsGrid", () => {
  it("starts empty with gridLoading false", () => {
    const { result } = renderHook(() =>
      useBookingsGrid({ restaurantId: null, viewMode: "timetable" })
    );
    expect(result.current.gridSections).toEqual([]);
    expect(result.current.gridBookings).toEqual([]);
    expect(result.current.gridLoading).toBe(false);
  });

  it("loadGrid fetches sections + bookings for the given restaurant/date", async () => {
    const { result } = renderHook(() =>
      useBookingsGrid({ restaurantId: null, viewMode: "timetable" })
    );
    const date = new Date("2026-07-15");
    await act(async () => {
      await result.current.loadGrid(5, date);
    });
    expect(mockAdminGetTables).toHaveBeenCalledWith(5);
    // getAdminBookings receives an isoDate string — just assert it was called with rid + a string.
    expect(mockGetAdminBookings).toHaveBeenCalledWith(5, expect.any(String));
    expect(result.current.gridSections).toBe(SECTIONS);
    expect(result.current.gridBookings).toBe(BOOKINGS);
    expect(result.current.gridLoading).toBe(false);
  });

  it("auto-loads on mount when restaurantId is set and viewMode is timetable", async () => {
    renderHook(() => useBookingsGrid({ restaurantId: 7, viewMode: "timetable" }));
    // The mount effect fires synchronously after render.
    expect(mockAdminGetTables).toHaveBeenCalledWith(7);
  });

  it("does NOT auto-load on mount when viewMode is list", () => {
    renderHook(() => useBookingsGrid({ restaurantId: 7, viewMode: "list" }));
    expect(mockAdminGetTables).not.toHaveBeenCalled();
  });

  it("reloads when restaurantId changes (while in timetable view)", () => {
    const { rerender } = renderHook(
      ({ rid }: { rid: number | null }) =>
        useBookingsGrid({ restaurantId: rid, viewMode: "timetable" }),
      { initialProps: { rid: 1 } }
    );
    expect(mockAdminGetTables).toHaveBeenCalledWith(1);
    rerender({ rid: 2 });
    expect(mockAdminGetTables).toHaveBeenCalledWith(2);
  });

  it("handleGridDateChange steps the date forward by +1 day and reloads", async () => {
    const { result } = renderHook(() =>
      useBookingsGrid({ restaurantId: 3, viewMode: "timetable" })
    );
    const before = new Date(result.current.gridDate);
    await act(async () => {
      result.current.handleGridDateChange(1);
    });
    const after = result.current.gridDate;
    const dayDiff = Math.round((after.getTime() - before.getTime()) / 86_400_000);
    expect(dayDiff).toBe(1);
    expect(mockAdminGetTables).toHaveBeenCalledWith(3);
  });

  it("handleGridDateChange steps the date backward by -1 day", async () => {
    const { result } = renderHook(() =>
      useBookingsGrid({ restaurantId: 3, viewMode: "timetable" })
    );
    const before = new Date(result.current.gridDate);
    await act(async () => {
      result.current.handleGridDateChange(-1);
    });
    const dayDiff = Math.round((result.current.gridDate.getTime() - before.getTime()) / 86_400_000);
    expect(dayDiff).toBe(-1);
  });

  it("resetToToday sets the date to today and reloads", async () => {
    const { result } = renderHook(() =>
      useBookingsGrid({ restaurantId: 4, viewMode: "timetable" })
    );
    // Step away from today first.
    await act(async () => {
      result.current.handleGridDateChange(5);
    });
    const todayBefore = new Date();
    await act(async () => {
      result.current.resetToToday();
    });
    expect(result.current.gridDate.toDateString()).toBe(todayBefore.toDateString());
    expect(mockAdminGetTables).toHaveBeenLastCalledWith(4);
  });

  it("sets gridLoading true while a load is in flight, false after", async () => {
    let resolveTables!: (v: typeof SECTIONS) => void;
    mockAdminGetTables.mockReturnValue(
      new Promise((r) => {
        resolveTables = r;
      })
    );
    const { result } = renderHook(() =>
      useBookingsGrid({ restaurantId: null, viewMode: "timetable" })
    );
    let loadPromise!: Promise<void>;
    act(() => {
      loadPromise = result.current.loadGrid(8, new Date("2026-07-15"));
    });
    expect(result.current.gridLoading).toBe(true);
    await act(async () => {
      resolveTables(SECTIONS);
      await loadPromise;
    });
    expect(result.current.gridLoading).toBe(false);
  });
});
