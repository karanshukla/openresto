import { get, post, put } from "./client";
import { apiErrorMessage } from "./errors";
import type { BookingDetailDto } from "./admin";
import type { WaitlistBoard, WaitlistResult } from "./waitlist";

/** What a tile is doing now, derived on the server from the bookings and its clock. */
export type FloorTileState = "free" | "bookedSoon" | "seated" | "overdue";

export interface FloorUnit {
  kind: "table" | "group";
  id: number;
  /** Empty for an unnamed table. */
  name: string;
  seats: number;
  walkInOnly: boolean;
  /** For a group, the tables pushed together. */
  memberTableIds: number[];
  state: FloorTileState;
  currentBookingId: number | null;
  currentEndsAt: string | null;
  nextBookingId: number | null;
  nextBookingAt: string | null;
}

export interface FloorSection {
  id: number;
  name: string;
  units: FloorUnit[];
}

/** The host stand's one read per poll. */
export interface Tonight {
  restaurantId: number;
  restaurantName: string;
  timezone: string;
  /** The server's clock when it derived the states. */
  now: string;
  bookedSoonMinutes: number;
  sections: FloorSection[];
  groups: FloorUnit[];
  bookings: BookingDetailDto[];
  waitlist: WaitlistBoard;
  /** Per waiting party size, the units free for a whole sitting from now. */
  seatableNow: SeatableNow[];
}

export interface SeatableNow {
  seats: number;
  tableIds: number[];
  tableGroupIds: number[];
}

export async function getTonight(restaurantId: number): Promise<Tonight | null> {
  try {
    const res = await get(`/admin/restaurants/${restaurantId}/tonight`);
    return res.ok ? await res.json() : null;
  } catch (err) {
    console.error("getTonight error:", err);
    return null;
  }
}

async function refused(res: Response, fallback: string): Promise<{ ok: false; message: string }> {
  const body = await res.json().catch(() => ({}));
  return { ok: false, message: apiErrorMessage(body, fallback) };
}

/** Moves a single-table booking onto another table; the server refuses one already taken. */
export async function moveBookingToTable(
  bookingId: number,
  tableId: number
): Promise<WaitlistResult<null>> {
  const fallback = "Couldn't move the booking to that table.";
  try {
    const res = await put(`/admin/bookings/${bookingId}`, { tableId });
    return res.ok ? { ok: true, value: null } : await refused(res, fallback);
  } catch (err) {
    console.error("moveBookingToTable error:", err);
    return { ok: false, message: fallback };
  }
}

/** Seats a waitlist party on the tile the host picked rather than the smallest that fits. */
export async function seatWaitlistEntryAt(
  entryId: number,
  unit: Pick<FloorUnit, "kind" | "id">
): Promise<WaitlistResult<null>> {
  const fallback = "Couldn't seat the party there.";
  const body = unit.kind === "group" ? { tableGroupId: unit.id } : { tableId: unit.id };
  try {
    const res = await post(`/admin/waitlist/${entryId}/seat`, body);
    return res.ok ? { ok: true, value: null } : await refused(res, fallback);
  } catch (err) {
    console.error("seatWaitlistEntryAt error:", err);
    return { ok: false, message: fallback };
  }
}
