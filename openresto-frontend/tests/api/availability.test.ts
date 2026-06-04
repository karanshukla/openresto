import { fetchAvailability } from "@/api/availability";
import { get } from "@/api/client";

jest.mock("@/api/client", () => ({ get: jest.fn() }));

const mockData = {
  restaurantId: 1,
  date: "2024-06-01",
  slots: [{ time: "12:00", isAvailable: true, availableTableIds: [1], category: "Lunch" as const }],
};

describe("fetchAvailability", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns data when response is ok", async () => {
    (get as jest.Mock).mockResolvedValue({ ok: true, json: async () => mockData });
    const result = await fetchAvailability(1, "2024-06-01", 2);
    expect(result).toEqual(mockData);
    expect(get).toHaveBeenCalledWith("/restaurants/1/availability?date=2024-06-01&seats=2");
  });

  it("returns null when response is not ok", async () => {
    (get as jest.Mock).mockResolvedValue({ ok: false });
    const result = await fetchAvailability(1, "2024-06-01", 2);
    expect(result).toBeNull();
  });

  it("returns null and logs error when fetch throws", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    (get as jest.Mock).mockRejectedValue(new Error("Network error"));
    const result = await fetchAvailability(1, "2024-06-01", 2);
    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
