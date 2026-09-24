import { get, post, put } from "./client";
import { apiErrorMessage } from "./errors";
import type { ReminderRegistration } from "./reminders";

export type WaitlistStatus = "waiting" | "notified" | "seated" | "left" | "expired";

/** What a guest sees before joining: whether the queue is open and the wait a party would face. */
export interface WaitlistQuote {
  restaurantId: number;
  acceptingGuests: boolean;
  partiesWaiting: number;
  /** Null when no table at the location can seat the party. */
  estimatedWaitMinutes: number | null;
}

/** A guest's own place in the queue, read by the unguessable ref they were given on joining. */
export interface WaitlistEntryStatus {
  ref: string;
  number: number;
  restaurantId: number;
  restaurantName: string;
  name: string;
  seats: number;
  status: WaitlistStatus;
  /** Null once the entry has left the queue. */
  partiesAhead: number | null;
  estimatedWaitMinutes: number | null;
  joinedAt: string;
  notifiedAt: string | null;
  /** Whether a device will be pushed when the table is ready. */
  pushEnabled: boolean;
}

export interface JoinWaitlistRequest {
  name: string;
  seats: number;
  email?: string;
  locale?: string;
}

export interface WaitlistEntry {
  id: number;
  number: number;
  /** Null for an API key without guests:read. */
  name: string | null;
  email: string | null;
  seats: number;
  status: WaitlistStatus;
  joinedAt: string;
  notifiedAt: string | null;
  partiesAhead: number;
  estimatedWaitMinutes: number | null;
  canSeatNow: boolean;
}

export interface WaitlistBoard {
  restaurantId: number;
  acceptingGuests: boolean;
  entries: WaitlistEntry[];
}

/** A write the server refused, carrying its message in the viewer's language. */
export type WaitlistResult<T> = { ok: true; value: T } | { ok: false; message: string };

async function rejection(res: Response, fallback: string): Promise<{ ok: false; message: string }> {
  const body = await res.json().catch(() => ({}));
  return { ok: false, message: apiErrorMessage(body, fallback) };
}

export async function getWaitlistQuote(
  restaurantId: number,
  seats: number
): Promise<WaitlistQuote | null> {
  try {
    const res = await get(`/restaurants/${restaurantId}/waitlist?seats=${seats}`);
    return res.ok ? await res.json() : null;
  } catch (err) {
    console.error("getWaitlistQuote error:", err);
    return null;
  }
}

export async function joinWaitlist(
  restaurantId: number,
  req: JoinWaitlistRequest
): Promise<WaitlistResult<WaitlistEntryStatus>> {
  const fallback = "Couldn't join the waitlist. Please try again.";
  try {
    const res = await post(`/restaurants/${restaurantId}/waitlist`, req);
    return res.ok ? { ok: true, value: await res.json() } : await rejection(res, fallback);
  } catch (err) {
    console.error("joinWaitlist error:", err);
    return { ok: false, message: fallback };
  }
}

/** `undefined` when the request failed, `null` when the ref is unknown. */
export async function getWaitlistStatus(
  entryRef: string
): Promise<WaitlistEntryStatus | null | undefined> {
  try {
    const res = await get(`/waitlist/${encodeURIComponent(entryRef)}`);
    if (res.status === 404) return null;
    return res.ok ? await res.json() : undefined;
  } catch (err) {
    console.error("getWaitlistStatus error:", err);
    return undefined;
  }
}

export async function leaveWaitlist(entryRef: string): Promise<boolean> {
  try {
    const res = await post(`/waitlist/${encodeURIComponent(entryRef)}/leave`);
    return res.ok;
  } catch (err) {
    console.error("leaveWaitlist error:", err);
    return false;
  }
}

/**
 * Points the "table ready" push at this device, replacing any device that asked before. The
 * address is the same one booking reminders register.
 */
export async function setWaitlistPush(
  entryRef: string,
  registration: ReminderRegistration
): Promise<boolean> {
  try {
    const res = await put(`/waitlist/${encodeURIComponent(entryRef)}/push`, registration);
    return res.ok;
  } catch (err) {
    console.error("setWaitlistPush error:", err);
    return false;
  }
}

export async function getWaitlistBoard(restaurantId: number): Promise<WaitlistBoard | null> {
  try {
    const res = await get(`/admin/restaurants/${restaurantId}/waitlist`);
    return res.ok ? await res.json() : null;
  } catch (err) {
    console.error("getWaitlistBoard error:", err);
    return null;
  }
}

export async function addWaitlistParty(
  restaurantId: number,
  req: JoinWaitlistRequest
): Promise<WaitlistResult<WaitlistEntry>> {
  const fallback = "Couldn't add the party.";
  try {
    const res = await post(`/admin/restaurants/${restaurantId}/waitlist`, req);
    return res.ok ? { ok: true, value: await res.json() } : await rejection(res, fallback);
  } catch (err) {
    console.error("addWaitlistParty error:", err);
    return { ok: false, message: fallback };
  }
}

/** Calls, seats or removes a party; `seat` picks the smallest free table that fits. */
export async function actOnWaitlistEntry(
  id: number,
  action: "notify" | "seat" | "remove"
): Promise<WaitlistResult<null>> {
  const fallback = "That didn't go through. Refresh and try again.";
  try {
    const res = await post(`/admin/waitlist/${id}/${action}`, action === "seat" ? {} : undefined);
    return res.ok ? { ok: true, value: null } : await rejection(res, fallback);
  } catch (err) {
    console.error("actOnWaitlistEntry error:", err);
    return { ok: false, message: fallback };
  }
}
