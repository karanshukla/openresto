import { latestStartMinutes, suggestDate } from "@/components/booking/bookingSuggestions";
import { getNowInTimezone } from "@/utils/date";

jest.mock("@/utils/date", () => ({
  getNowInTimezone: jest.fn(),
}));

// 2026-06-23 is a Tuesday.
const tuesday = "2026-06-23";
const restaurant = { openTime: "11:00", closeTime: "22:00" };

describe("latestStartMinutes", () => {
  it("keeps the form's existing before-close margin when the day has no last booking time", () => {
    expect(latestStartMinutes(restaurant, tuesday)).toBe(21 * 60 + 45);
  });

  it("is the day's last booking time when it has one", () => {
    expect(latestStartMinutes({ ...restaurant, lastBookingTime: "20:15" }, tuesday)).toBe(
      20 * 60 + 15
    );
  });

  it("prefers the day's own last booking over the restaurant-wide one", () => {
    const perDay = {
      ...restaurant,
      lastBookingTime: "20:15",
      openHours: [{ day: 2, open: "11:00", close: "22:00", lastBooking: "19:00" }],
    };
    expect(latestStartMinutes(perDay, tuesday)).toBe(19 * 60);
  });
});

describe("suggestDate", () => {
  it("keeps today while the last booking time is still ahead", () => {
    (getNowInTimezone as jest.Mock).mockReturnValue({ dateStr: tuesday, hours: 20, minutes: 0 });
    expect(suggestDate({ ...restaurant, lastBookingTime: "20:15" }, "UTC")).toBe(tuesday);
  });

  it("moves to tomorrow once the last booking time has passed", () => {
    (getNowInTimezone as jest.Mock).mockReturnValue({ dateStr: tuesday, hours: 20, minutes: 30 });
    expect(suggestDate({ ...restaurant, lastBookingTime: "20:15" }, "UTC")).toBe("2026-06-24");
  });
});
