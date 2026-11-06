import {
  dateExceptionDates,
  getDateException,
  removeDateException,
  upcomingDateExceptions,
  upsertDateException,
} from "@/utils/dateExceptions";
import type { DateExceptionDto } from "@/api/restaurants";

const closed: DateExceptionDto = { date: "2026-12-25", type: "closed" };
const special: DateExceptionDto = {
  date: "2026-12-31",
  type: "specialHours",
  open: "18:00",
  close: "01:00",
  lastBooking: "23:00",
};
const walkIn: DateExceptionDto = { date: "2026-12-24", type: "walkInOnly" };

describe("getDateException", () => {
  it("finds the entry on its date and nothing on the day after", () => {
    const r = { dateExceptions: [closed] };
    expect(getDateException(r, "2026-12-25")).toEqual(closed);
    expect(getDateException(r, "2026-12-26")).toBeNull();
  });

  it("is null when the location has no exceptions at all", () => {
    expect(getDateException({}, "2026-12-25")).toBeNull();
    expect(getDateException({ dateExceptions: null }, "2026-12-25")).toBeNull();
  });
});

describe("upcomingDateExceptions", () => {
  it("keeps today, drops yesterday and sorts by date", () => {
    const r = { dateExceptions: [special, closed, walkIn] };
    expect(upcomingDateExceptions(r, "2026-12-25").map((e) => e.date)).toEqual([
      "2026-12-25",
      "2026-12-31",
    ]);
  });
});

describe("dateExceptionDates", () => {
  it("lists only the dates of one type", () => {
    const r = { dateExceptions: [special, closed, walkIn] };
    expect(dateExceptionDates(r, "closed")).toEqual(["2026-12-25"]);
    expect(dateExceptionDates(r, "specialHours")).toEqual(["2026-12-31"]);
    expect(dateExceptionDates({}, "walkInOnly")).toEqual([]);
  });
});

describe("upsertDateException", () => {
  it("appends a new date in date order", () => {
    expect(upsertDateException([special], closed).map((e) => e.date)).toEqual([
      "2026-12-25",
      "2026-12-31",
    ]);
  });

  it("replaces the entry already on that date", () => {
    const replaced = upsertDateException([closed, special], {
      date: "2026-12-25",
      type: "walkInOnly",
    });
    expect(replaced).toHaveLength(2);
    expect(replaced[0]).toEqual({ date: "2026-12-25", type: "walkInOnly" });
  });
});

describe("removeDateException", () => {
  it("drops only the named date", () => {
    expect(removeDateException([closed, special], "2026-12-25")).toEqual([special]);
    expect(removeDateException([closed], "2026-01-01")).toEqual([closed]);
  });
});
