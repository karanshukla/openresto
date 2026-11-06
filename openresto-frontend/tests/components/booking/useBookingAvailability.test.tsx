import { renderHook, waitFor } from "@testing-library/react-native";
import { useBookingAvailability } from "@/components/booking/useBookingAvailability";

const mockFetchAvailability = jest.fn();
jest.mock("@/api/availability", () => ({
  fetchAvailability: (...args: unknown[]) => mockFetchAvailability(...args),
}));

// 2026-06-30 is a Tuesday, an open weekday for the fixture; 2026-07-04 a Saturday it keeps closed.
const restaurant = {
  id: 1,
  name: "Bistro",
  openTime: "11:00",
  closeTime: "22:00",
  openDays: "1,2,3,4,5",
  timezone: "UTC",
  sections: [],
};

function run(args: Partial<Parameters<typeof useBookingAvailability>[0]>) {
  return renderHook(() =>
    useBookingAvailability({
      restaurant,
      date: "2026-06-30",
      seats: 2,
      time: "19:00",
      onTimeCorrected: jest.fn(),
      ...args,
    })
  );
}

describe("useBookingAvailability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchAvailability.mockResolvedValue({
      slots: [{ time: "19:00", isAvailable: true, availableTableIds: [1], category: "Dinner" }],
    });
  });

  it("fetches an open weekday", async () => {
    const { result } = run({});
    await waitFor(() => expect(result.current.availabilitySlots).toHaveLength(1));
    expect(mockFetchAvailability).toHaveBeenCalledWith(1, "2026-06-30", 2);
  });

  it("fetches nothing for a closed date on an open weekday", async () => {
    const { result } = run({
      restaurant: { ...restaurant, dateExceptions: [{ date: "2026-06-30", type: "closed" }] },
    });
    await waitFor(() => expect(result.current.loadingAvailability).toBe(false));
    expect(mockFetchAvailability).not.toHaveBeenCalled();
    expect(result.current.availabilitySlots).toEqual([]);
  });

  it("fetches a special-hours date on a closed weekday", async () => {
    const { result } = run({
      date: "2026-07-04",
      restaurant: {
        ...restaurant,
        dateExceptions: [
          { date: "2026-07-04", type: "specialHours", open: "12:00", close: "16:00" },
        ],
      },
    });
    await waitFor(() => expect(result.current.availabilitySlots).toHaveLength(1));
    expect(mockFetchAvailability).toHaveBeenCalledWith(1, "2026-07-04", 2);
  });

  it("fetches nothing for a party over the online maximum", async () => {
    const { result } = run({ restaurant: { ...restaurant, maxOnlinePartySize: 4 }, seats: 5 });
    await waitFor(() => expect(result.current.loadingAvailability).toBe(false));
    expect(mockFetchAvailability).not.toHaveBeenCalled();
  });

  it("fetches nothing for a party under the online minimum", async () => {
    const { result } = run({ restaurant: { ...restaurant, minOnlinePartySize: 2 }, seats: 1 });
    await waitFor(() => expect(result.current.loadingAvailability).toBe(false));
    expect(mockFetchAvailability).not.toHaveBeenCalled();
  });

  it("corrects a picked time that is no longer bookable to the first open slot", async () => {
    const onTimeCorrected = jest.fn();
    mockFetchAvailability.mockResolvedValue({
      slots: [
        { time: "18:00", isAvailable: false, availableTableIds: [], category: "Dinner" },
        { time: "18:30", isAvailable: true, availableTableIds: [1], category: "Dinner" },
      ],
    });
    run({ time: "18:00", onTimeCorrected });
    await waitFor(() => expect(onTimeCorrected).toHaveBeenCalledWith("18:30"));
  });
});
