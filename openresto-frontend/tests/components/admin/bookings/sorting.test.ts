import {
  compareBookings,
  defaultSortFor,
  nextSort,
  sortBookings,
} from "@/components/admin/bookings/sorting";
import { BookingDetailDto, BookingStatusFilter } from "@/api/admin";

const mk = (over: Partial<BookingDetailDto>): BookingDetailDto =>
  ({
    id: 1,
    restaurantId: 1,
    restaurantName: "R",
    sectionId: null,
    sectionName: "S",
    tableId: null,
    tableName: "T1",
    date: "2026-01-01T12:00:00Z",
    customerEmail: "a@x.com",
    seats: 2,
    ...over,
  }) as BookingDetailDto;

const A = mk({
  id: 1,
  customerName: "Alice",
  date: "2026-03-01T10:00:00Z",
  seats: 4,
  tableName: "T3",
});
const B = mk({
  id: 2,
  customerName: "Bob",
  date: "2026-02-01T10:00:00Z",
  seats: 2,
  tableName: "T1",
});
const C = mk({
  id: 3,
  customerName: "Carol",
  date: "2026-01-01T10:00:00Z",
  seats: 6,
  tableName: "T2",
});

describe("defaultSortFor", () => {
  it("defaults active/all to date ascending (soonest first)", () => {
    expect(defaultSortFor("active")).toEqual({ key: "date", dir: "asc" });
    expect(defaultSortFor("all")).toEqual({ key: "date", dir: "asc" });
  });

  it("defaults past/cancelled to date descending (most-recent first)", () => {
    const filters: BookingStatusFilter[] = ["past", "cancelled"];
    filters.forEach((f) => expect(defaultSortFor(f)).toEqual({ key: "date", dir: "desc" }));
  });
});

describe("nextSort", () => {
  it("flips direction when the same column is pressed", () => {
    expect(nextSort({ key: "date", dir: "asc" }, "date")).toEqual({ key: "date", dir: "desc" });
    expect(nextSort({ key: "date", dir: "desc" }, "date")).toEqual({ key: "date", dir: "asc" });
  });

  it("switches to a new column with its natural default direction", () => {
    // date/seats/status default to desc (newest/largest/most-urgent first)
    expect(nextSort({ key: "guest", dir: "asc" }, "date")).toEqual({ key: "date", dir: "desc" });
    expect(nextSort({ key: "date", dir: "asc" }, "seats")).toEqual({ key: "seats", dir: "desc" });
    expect(nextSort({ key: "date", dir: "asc" }, "status")).toEqual({ key: "status", dir: "desc" });
    // guest/table default to asc (A→Z)
    expect(nextSort({ key: "date", dir: "desc" }, "guest")).toEqual({ key: "guest", dir: "asc" });
    expect(nextSort({ key: "date", dir: "desc" }, "table")).toEqual({ key: "table", dir: "asc" });
  });
});

describe("compareBookings", () => {
  it("sorts by date ascending and descending", () => {
    expect(compareBookings(A, B, { key: "date", dir: "asc" })).toBeGreaterThan(0); // A is later
    expect(compareBookings(A, B, { key: "date", dir: "desc" })).toBeLessThan(0);
  });

  it("sorts by guest alphabetically (case-insensitive), falling back to email", () => {
    expect(compareBookings(A, B, { key: "guest", dir: "asc" })).toBeLessThan(0); // Alice < Bob
    const noName1 = mk({ id: 9, customerName: undefined, customerEmail: "zoe@x.com" });
    const noName2 = mk({ id: 10, customerName: undefined, customerEmail: "amy@x.com" });
    expect(compareBookings(noName1, noName2, { key: "guest", dir: "asc" })).toBeGreaterThan(0);
  });

  it("sorts by seats numerically", () => {
    expect(compareBookings(A, B, { key: "seats", dir: "asc" })).toBeGreaterThan(0); // 4 > 2
    expect(compareBookings(A, B, { key: "seats", dir: "desc" })).toBeLessThan(0);
  });

  it("sorts by table name alphabetically", () => {
    expect(compareBookings(A, B, { key: "table", dir: "asc" })).toBeGreaterThan(0); // T3 > T1
    expect(compareBookings(A, B, { key: "table", dir: "desc" })).toBeLessThan(0);
  });

  it("sorts by status lifecycle rank (cancelled last; arrived > scheduled > completed asc)", () => {
    // Build bookings that land in distinct status variants relative to now.
    const now = Date.now();
    const min = 60 * 1000;
    const arrived = mk({ id: 11, date: new Date(now - 2 * min).toISOString() }); // arrived
    const scheduled = mk({ id: 12, date: new Date(now + 120 * min).toISOString() }); // scheduled
    const completed = mk({ id: 13, date: new Date(now - 100 * min).toISOString() }); // completed
    const cancelled = mk({
      id: 14,
      date: new Date(now + 120 * min).toISOString(),
      isCancelled: true,
    });

    // Ascending rank: completed(low) < scheduled < arrived ; cancelled is lowest.
    expect(compareBookings(completed, arrived, { key: "status", dir: "asc" })).toBeLessThan(0);
    expect(compareBookings(arrived, scheduled, { key: "status", dir: "asc" })).toBeGreaterThan(0);
    expect(compareBookings(scheduled, completed, { key: "status", dir: "asc" })).toBeGreaterThan(0);
    // Cancelled ranks below everything (asc => comes last).
    expect(compareBookings(cancelled, completed, { key: "status", dir: "asc" })).toBeLessThan(0);
  });
});

describe("sortBookings", () => {
  it("returns a new sorted copy and does not mutate the input", () => {
    const input = [A, B, C];
    const out = sortBookings(input, { key: "date", dir: "asc" });
    expect(out.map((b) => b.id)).toEqual([C.id, B.id, A.id]);
    // input order untouched
    expect(input.map((b) => b.id)).toEqual([A.id, B.id, C.id]);
    // new array reference
    expect(out).not.toBe(input);
  });

  it("sorts seats descending (largest party first)", () => {
    const out = sortBookings([A, B, C], { key: "seats", dir: "desc" });
    expect(out.map((b) => b.id)).toEqual([C.id, A.id, B.id]);
  });

  it("sorts by status descending (most attention-worthy first, cancelled last)", () => {
    const now = Date.now();
    const min = 60 * 1000;
    const scheduled = mk({ id: 12, date: new Date(now + 120 * min).toISOString() });
    const arrived = mk({ id: 11, date: new Date(now - 2 * min).toISOString() });
    const cancelled = mk({
      id: 14,
      date: new Date(now + 120 * min).toISOString(),
      isCancelled: true,
    });
    // desc => highest rank first: arrived > scheduled > ... > cancelled
    const out = sortBookings([scheduled, cancelled, arrived], { key: "status", dir: "desc" });
    expect(out.map((b) => b.id)).toEqual([arrived.id, scheduled.id, cancelled.id]);
  });
});
