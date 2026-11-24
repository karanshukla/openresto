import {
  latestStartMinutes,
  suggestDate,
  suggestNextBooking,
} from "@/components/booking/bookingSuggestions";
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

describe("suggestNextBooking", () => {
  const weekend = {
    openTime: "11:00",
    closeTime: "20:00",
    lastBookingTime: "19:30",
    openDays: "5,6,7",
  };

  it("defaults to Friday at opening after Sunday's last booking slot", () => {
    (getNowInTimezone as jest.Mock).mockReturnValue({
      dateStr: "2026-11-22",
      hours: 20,
      minutes: 0,
    });
    expect(suggestNextBooking(weekend, "Europe/Amsterdam")).toEqual({
      date: "2026-11-27",
      time: "11:00",
    });
  });

  it("uses the next valid interval when today's last slot has not passed", () => {
    (getNowInTimezone as jest.Mock).mockReturnValue({
      dateStr: "2026-11-22",
      hours: 19,
      minutes: 0,
    });
    expect(suggestNextBooking(weekend, "Europe/Amsterdam")).toEqual({
      date: "2026-11-22",
      time: "19:15",
    });
  });

  it("skips a closed exception even if the weekday is normally open", () => {
    (getNowInTimezone as jest.Mock).mockReturnValue({
      dateStr: "2026-11-22",
      hours: 20,
      minutes: 0,
    });
    expect(
      suggestNextBooking(
        { ...weekend, dateExceptions: [{ date: "2026-11-27", type: "closed" }] },
        "Europe/Amsterdam"
      )
    ).toEqual({ date: "2026-11-28", time: "11:00" });
  });

  it("uses a special-hours exception on a normally closed weekday", () => {
    (getNowInTimezone as jest.Mock).mockReturnValue({
      dateStr: "2026-11-22",
      hours: 20,
      minutes: 0,
    });
    expect(
      suggestNextBooking(
        {
          ...weekend,
          dateExceptions: [
            {
              date: "2026-11-24",
              type: "specialHours",
              open: "15:00",
              close: "20:00",
              lastBooking: "19:00",
            },
          ],
        },
        "Europe/Amsterdam"
      )
    ).toEqual({ date: "2026-11-24", time: "15:00" });
  });

  it("skips a walk-in-only day", () => {
    (getNowInTimezone as jest.Mock).mockReturnValue({
      dateStr: "2026-11-22",
      hours: 20,
      minutes: 0,
    });
    expect(suggestNextBooking({ ...weekend, walkInDays: "5" }, "Europe/Amsterdam")).toEqual({
      date: "2026-11-28",
      time: "11:00",
    });
  });

  it("honours the minimum notice and slot interval", () => {
    (getNowInTimezone as jest.Mock).mockReturnValue({
      dateStr: "2026-11-22",
      hours: 11,
      minutes: 4,
    });
    expect(
      suggestNextBooking(
        { ...weekend, minBookingNoticeMinutes: 45, bookingSlotIntervalMinutes: 30 },
        "Europe/Amsterdam"
      )
    ).toEqual({ date: "2026-11-22", time: "12:00" });
  });

  it("returns null if no slot is within the configured booking horizon", () => {
    (getNowInTimezone as jest.Mock).mockReturnValue({
      dateStr: "2026-11-22",
      hours: 20,
      minutes: 0,
    });
    expect(
      suggestNextBooking({ ...weekend, maxBookingDaysAhead: 1 }, "Europe/Amsterdam")
    ).toBeNull();
  });
});
