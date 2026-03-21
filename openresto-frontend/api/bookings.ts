import { getAuthHeaders } from "./auth";

export interface BookingDto {
  id: number;
  tableId: number;
  sectionId: number;
  restaurantId: number;
  date: string;
  customerEmail: string;
  seats: number;
  isHeld: boolean;
}

export interface BookingCreationDto {
  restaurantId: number;
  tableId: number;
  sectionId: number;
  customerEmail: string;
  seats: number;
  date: string;
  holdId?: string | null;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL;

function buildEndpoint(path: string): string {
  const base = API_URL?.replace(/\/$/, "") ?? "";
  if (!base) return `/api${path}`;
  return base.includes("/api") ? `${base}${path}` : `${base}/api${path}`;
}

export async function createBooking(
  booking: BookingCreationDto
): Promise<BookingDto | null> {
  const res = await fetch(buildEndpoint("/bookings"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(booking),
  });

  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? "This table is no longer available.");
  }

  if (!res.ok) throw new Error("Failed to create booking");

  return await res.json();
}

export async function getBookingById(
  id: number
): Promise<BookingDto | null> {
  try {
    const res = await fetch(buildEndpoint(`/bookings/${id}`));
    if (!res.ok) throw new Error("Failed to fetch booking");
    return await res.json();
  } catch (err) {
    console.error("getBookingById error:", err);
    return null;
  }
}

export async function getBookingsByRestaurant(
  restaurantId: number
): Promise<BookingDto[]> {
  try {
    const res = await fetch(
      buildEndpoint(`/bookings/restaurant/${restaurantId}`),
      { headers: getAuthHeaders() }
    );
    if (!res.ok) throw new Error("Failed to fetch bookings");
    return await res.json();
  } catch (err) {
    console.error("getBookingsByRestaurant error:", err);
    return [];
  }
}

export async function deleteBooking(id: number): Promise<boolean> {
  try {
    const res = await fetch(buildEndpoint(`/bookings/${id}`), {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    return res.ok;
  } catch (err) {
    console.error("deleteBooking error:", err);
    return false;
  }
}
