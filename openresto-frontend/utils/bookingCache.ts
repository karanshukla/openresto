import { get } from "@/api/client";

export interface CachedBooking {
  bookingRef: string;
  email: string;
  date: string;
  seats: number;
  restaurantName?: string;
  createdAt: string;
}

/**
 * Fetch recent bookings from the encrypted HttpOnly cookie via the API.
 * The cookie is sent automatically by the browser — no JS access to the data.
 */
export async function fetchCachedBookings(): Promise<CachedBooking[]> {
  try {
    const res = await get("/bookings/my-recent");
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
