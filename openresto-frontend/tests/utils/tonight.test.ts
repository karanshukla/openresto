import type { BookingDetailDto } from "@/api/admin";
import type { FloorUnit } from "@/api/tonight";
import {
  arrivalGroupFor,
  DUE_NOW_MINUTES,
  floorCounts,
  groupArrivals,
  isAwaitingTable,
  LATE_AFTER_MINUTES,
  minutesUntil,
  NEXT_HOUR_MINUTES,
  tileFit,
  type SeatingSource,
} from "@/utils/tonight";

const NOW = Date.parse("2026-11-05T19:00:00Z");
const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

const booking = (over: Partial<BookingDetailDto> = {}): BookingDetailDto => ({
  id: 1,
  restaurantId: 1,
  restaurantName: "Flagship",
  sectionId: 1,
  sectionName: "Main",
  tableId: 3,
  tableName: "T3",
  date: at(0),
  customerEmail: "a@example.com",
  seats: 2,
  status: "Booked",
  ...over,
});

const unit = (over: Partial<FloorUnit> = {}): FloorUnit => ({
  kind: "table",
  id: 3,
  name: "T3",
  seats: 4,
  walkInOnly: false,
  memberTableIds: [],
  state: "free",
  currentBookingId: null,
  currentEndsAt: null,
  nextBookingId: null,
  nextBookingAt: null,
  ...over,
});

describe("minutesUntil", () => {
  it("is negative once the time has passed", () => {
    expect(minutesUntil(at(12), NOW)).toBe(12);
    expect(minutesUntil(at(-7), NOW)).toBe(-7);
  });
});

describe("arrivalGroupFor", () => {
  it("is due now at exactly the late threshold, and late a minute past it", () => {
    expect(arrivalGroupFor({ date: at(-LATE_AFTER_MINUTES) }, NOW)).toBe("dueNow");
    expect(arrivalGroupFor({ date: at(-LATE_AFTER_MINUTES - 1) }, NOW)).toBe("late");
  });

  it("is due now up to the due-now horizon, and next hour a minute after", () => {
    expect(arrivalGroupFor({ date: at(DUE_NOW_MINUTES) }, NOW)).toBe("dueNow");
    expect(arrivalGroupFor({ date: at(DUE_NOW_MINUTES + 1) }, NOW)).toBe("nextHour");
  });

  it("is next hour up to sixty minutes, and later tonight a minute after", () => {
    expect(arrivalGroupFor({ date: at(NEXT_HOUR_MINUTES) }, NOW)).toBe("nextHour");
    expect(arrivalGroupFor({ date: at(NEXT_HOUR_MINUTES + 1) }, NOW)).toBe("later");
  });
});

describe("isAwaitingTable", () => {
  it("counts parties booked or checked in", () => {
    expect(isAwaitingTable(booking({ status: "Booked" }))).toBe(true);
    expect(isAwaitingTable(booking({ status: "Arrived" }))).toBe(true);
    expect(isAwaitingTable(booking({ status: undefined }))).toBe(true);
  });

  it("leaves out seated, ended and cancelled bookings", () => {
    expect(isAwaitingTable(booking({ status: "Seated" }))).toBe(false);
    expect(isAwaitingTable(booking({ status: "Finished" }))).toBe(false);
    expect(isAwaitingTable(booking({ status: "NoShow" }))).toBe(false);
    expect(isAwaitingTable(booking({ isCancelled: true }))).toBe(false);
  });
});

describe("groupArrivals", () => {
  it("groups awaiting parties in time order and drops empty groups", () => {
    const groups = groupArrivals(
      [
        booking({ id: 3, date: at(40) }),
        booking({ id: 1, date: at(-20) }),
        booking({ id: 2, date: at(30), status: "Seated" }),
        booking({ id: 4, date: at(10) }),
        booking({ id: 5, date: at(35) }),
      ],
      NOW
    );

    expect(groups.map((g) => [g.key, g.bookings.map((b) => b.id)])).toEqual([
      ["late", [1]],
      ["dueNow", [4]],
      ["nextHour", [5, 3]],
    ]);
  });
});

describe("tileFit", () => {
  const waitlist = (seats: number, tableIds: number[] = [3], tableGroupIds: number[] = []) =>
    ({
      kind: "waitlist",
      id: 9,
      seats,
      seatable: { seats, tableIds, tableGroupIds },
    }) satisfies SeatingSource;
  const fromBooking = (over: Partial<Extract<SeatingSource, { kind: "booking" }>> = {}) =>
    ({
      kind: "booking",
      id: 1,
      seats: 2,
      tableId: 5,
      isGroupBooking: false,
      ...over,
    }) satisfies SeatingSource;

  it("seats a party on a free tile of exactly its size, not one a seat smaller", () => {
    expect(tileFit(unit({ seats: 4 }), waitlist(4))).toBe("fits");
    expect(tileFit(unit({ seats: 3 }), waitlist(4))).toBe("tooSmall");
  });

  it("refuses a tile that is not free", () => {
    for (const state of ["seated", "overdue", "bookedSoon"] as const) {
      expect(tileFit(unit({ state }), waitlist(2))).toBe("taken");
    }
  });

  it("keeps a waitlist party off a free tile the server can't give a whole sitting", () => {
    expect(tileFit(unit(), waitlist(2, [7]))).toBe("neededSoon");
    expect(tileFit(unit(), { kind: "waitlist", id: 9, seats: 2, seatable: undefined })).toBe(
      "neededSoon"
    );
  });

  it("matches a group tile against the seatable groups, not the tables", () => {
    const group = unit({ kind: "group", id: 3, seats: 6 });
    expect(tileFit(group, waitlist(5, [3], []))).toBe("neededSoon");
    expect(tileFit(group, waitlist(5, [], [3]))).toBe("fits");
  });

  it("treats a booking's own table as held for it while free or booked soon", () => {
    expect(tileFit(unit({ id: 5, state: "bookedSoon" }), fromBooking())).toBe("own");
    expect(tileFit(unit({ id: 5, state: "free" }), fromBooking())).toBe("own");
    expect(tileFit(unit({ id: 5, state: "overdue" }), fromBooking())).toBe("taken");
  });

  it("moves a booking onto another free table", () => {
    expect(tileFit(unit(), fromBooking())).toBe("fits");
  });

  it("won't move a booking onto a group, or a group booking anywhere", () => {
    expect(tileFit(unit({ kind: "group" }), fromBooking())).toBe("groupMove");
    expect(tileFit(unit(), fromBooking({ isGroupBooking: true, tableId: null }))).toBe("groupMove");
  });
});

describe("floorCounts", () => {
  it("counts each state once per tile", () => {
    expect(
      floorCounts([
        unit({ state: "free" }),
        unit({ state: "free" }),
        unit({ state: "seated" }),
        unit({ state: "overdue" }),
      ])
    ).toEqual({ free: 2, bookedSoon: 0, seated: 1, overdue: 1 });
  });
});
