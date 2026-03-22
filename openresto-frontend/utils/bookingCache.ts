export interface CachedBooking {
  bookingRef: string;
  email: string;
  date: string;
  seats: number;
  restaurantName?: string;
  createdAt: string;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL;

function buildEndpoint(path: string): string {
  const base = API_URL?.replace(/\/$/, "") ?? "";
  if (!base) return `/api${path}`;
  return base.includes("/api") ? `${base}${path}` : `${base}/api${path}`;
}

/**
 * Fetch recent bookings from the encrypted HttpOnly cookie via the API.
 * The cookie is sent automatically by the browser — no JS access to the data.
 */
export async function fetchCachedBookings(): Promise<CachedBooking[]> {
  try {
    const res = await fetch(buildEndpoint("/bookings/my-recent"), {
      credentials: "include",
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
