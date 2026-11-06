import type { BookingDetailDto } from "@/api/admin";
import type { FloorUnit, SeatableNow } from "@/api/tonight";

const MINUTE_MS = 60_000;

/** A party this many minutes past its time, still not seated, is late rather than due. */
export const LATE_AFTER_MINUTES = 5;

/** A party due within this many minutes is "due now". */
export const DUE_NOW_MINUTES = 15;

/** The horizon of the "next hour" group; anything later is "later tonight". */
export const NEXT_HOUR_MINUTES = 60;

export type ArrivalGroupKey = "late" | "dueNow" | "nextHour" | "later";

export const ARRIVAL_GROUPS: ArrivalGroupKey[] = ["late", "dueNow", "nextHour", "later"];

/** Whole minutes from `nowMs` to `iso`, negative once it has passed. */
export function minutesUntil(iso: string, nowMs: number): number {
  return Math.round((new Date(iso).getTime() - nowMs) / MINUTE_MS);
}

/**
 * @see [tonight.test.ts](../tests/utils/tonight.test.ts) — pins each group's edge on both
 * sides: due now from five minutes late to fifteen ahead, the next hour up to sixty.
 */
export function arrivalGroupFor(
  booking: Pick<BookingDetailDto, "date">,
  nowMs: number
): ArrivalGroupKey {
  const minutes = minutesUntil(booking.date, nowMs);
  if (minutes < -LATE_AFTER_MINUTES) return "late";
  if (minutes <= DUE_NOW_MINUTES) return "dueNow";
  if (minutes <= NEXT_HOUR_MINUTES) return "nextHour";
  return "later";
}

/** A party still to sit down: booked or checked in at the stand, and not withdrawn. */
export function isAwaitingTable(booking: BookingDetailDto): boolean {
  const status = booking.status ?? "Booked";
  return !booking.isCancelled && (status === "Booked" || status === "Arrived");
}

/** Tonight's arrivals by group, each in time order, with empty groups left out. */
export function groupArrivals(
  bookings: BookingDetailDto[],
  nowMs: number
): { key: ArrivalGroupKey; bookings: BookingDetailDto[] }[] {
  const sorted = bookings
    .filter(isAwaitingTable)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return ARRIVAL_GROUPS.map((key) => ({
    key,
    bookings: sorted.filter((b) => arrivalGroupFor(b, nowMs) === key),
  })).filter((group) => group.bookings.length > 0);
}

/** The party the host has picked up and is about to put on a tile. */
export type SeatingSource =
  | { kind: "booking"; id: number; seats: number; tableId: number | null; isGroupBooking: boolean }
  | { kind: "waitlist"; id: number; seats: number; seatable: SeatableNow | undefined };

/** `own` is the booking's own table, held for it, so seating there moves nothing. */
export type TileFit = "fits" | "own" | "taken" | "tooSmall" | "groupMove" | "neededSoon";

/**
 * Whether the picked party can go on this tile. A waitlist party goes only where the server said
 * a whole sitting is free (`seatable`), so a tile that is free now but booked before they would
 * finish says so instead of offering a seat that comes back refused. A booking moves only
 * between single tables, because a group booking's unit is the group.
 *
 * @see [tonight.test.ts](../tests/utils/tonight.test.ts) — pins a party fitting a free tile of
 * exactly its size and not one a seat smaller, a booking's own held table, a booking refused
 * a group tile, and a waitlist party kept off a tile booked before a whole sitting.
 */
export function tileFit(unit: FloorUnit, source: SeatingSource): TileFit {
  const ownTable = source.kind === "booking" && unit.kind === "table" && source.tableId === unit.id;
  if (ownTable) return unit.state === "free" || unit.state === "bookedSoon" ? "own" : "taken";
  if (unit.state !== "free") return "taken";
  if (source.seats > unit.seats) return "tooSmall";
  if (source.kind === "waitlist") {
    const ids = unit.kind === "group" ? source.seatable?.tableGroupIds : source.seatable?.tableIds;
    return ids?.includes(unit.id) ? "fits" : "neededSoon";
  }
  if (unit.kind === "group" || source.isGroupBooking) return "groupMove";
  return "fits";
}

/** Counts for the header strip, read off every tile once. */
export function floorCounts(units: FloorUnit[]): Record<FloorUnit["state"], number> {
  const counts = { free: 0, bookedSoon: 0, seated: 0, overdue: 0 };
  for (const unit of units) counts[unit.state] += 1;
  return counts;
}
