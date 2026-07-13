import { post, del } from "./client";

export interface HoldRequest {
  restaurantId: number;
  tableId: number;
  sectionId: number;
  date: string; // ISO 8601
  currentHoldId?: string;
}

export interface HoldResponse {
  holdId: string;
  expiresAt: string; // ISO 8601
  secondsRemaining: number;
}

/** Successful hold. */
export type HoldSuccess = { ok: true; hold: HoldResponse };
/** Hold rejected (409 already-held, or 400 past-time / paused / closed / walk-in). */
export type HoldFailure = { ok: false; message: string };
export type HoldResult = HoldSuccess | HoldFailure;

const GENERIC_UNAVAILABLE = "Table not available for this date. Please choose another.";

export async function createHold(request: HoldRequest): Promise<HoldResult> {
  try {
    const res = await post("/holds", request);

    if (res.ok) {
      return { ok: true, hold: await res.json() };
    }

    // 409 (already held/booked) and 400 (past time, paused, closed, walk-in)
    // both carry a descriptive { message } from the backend — surface it
    // instead of discarding it so the customer sees the real reason.
    const body = await res.json().catch(() => ({}));
    return { ok: false, message: body?.message ?? GENERIC_UNAVAILABLE };
  } catch (err) {
    // Network failure or non-JSON body — fall back to a generic message.
    console.error("createHold error:", err);
    return { ok: false, message: GENERIC_UNAVAILABLE };
  }
}

export async function releaseHold(holdId: string): Promise<void> {
  try {
    await del(`/holds/${holdId}`);
  } catch {
    // Hold release failed — it will expire on its own
  }
}
