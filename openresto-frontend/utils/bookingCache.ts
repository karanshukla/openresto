import { Platform } from "react-native";
import { get } from "@/api/client";
import { StorageService } from "@/services/storage";

export interface CachedBooking {
  bookingRef: string;
  email: string;
  date: string;
  seats: number;
  restaurantName?: string;
  createdAt: string;
}

/** Where the native list lives. Web has no local list — the cookie is its store. */
const STORAGE_KEY = "openresto.recentBookings";

/**
 * How many of a diner's own bookings the lookup screen offers back to them. Matches what the
 * server-side cookie holds, so the two platforms surface a list of the same depth.
 */
export const MAX_REMEMBERED_BOOKINGS = 10;

function readLocal(): CachedBooking[] {
  const raw = StorageService.getItem(STORAGE_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CachedBooking[]) : [];
  } catch {
    return [];
  }
}

/**
 * Records a booking the diner just made, newest first, so `/lookup` can offer it back without
 * them retyping the reference.
 *
 * A no-op on web, where the encrypted HttpOnly cookie the API sets is the source of truth and
 * a second, JS-readable copy of the same list would be one the server could never expire.
 * Native has no cookie jar at all, which is what this exists for.
 *
 * @see [bookingCache.test.ts](../tests/utils/bookingCache.test.ts) — pins that the list
 * de-dupes by reference, caps at `MAX_REMEMBERED_BOOKINGS`, and stays empty on web.
 */
export function rememberBooking(entry: CachedBooking): void {
  if (Platform.OS === "web") return;
  const next = [entry, ...readLocal().filter((b) => b.bookingRef !== entry.bookingRef)].slice(
    0,
    MAX_REMEMBERED_BOOKINGS
  );
  StorageService.setItem(STORAGE_KEY, JSON.stringify(next));
}

/**
 * The diner's recent bookings. On web that means the encrypted HttpOnly cookie, read back
 * through the API because JS can't see it; on native it means the list `rememberBooking`
 * keeps, because there is no cookie to send.
 */
export async function fetchCachedBookings(): Promise<CachedBooking[]> {
  if (Platform.OS !== "web") return readLocal();
  try {
    const res = await get("/bookings/my-recent");
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
