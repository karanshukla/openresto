import { get, post, del } from "./client";

export interface BookingDto {
  id: number;
  tableId: number;
  sectionId: number;
  restaurantId: number;
  date: string;
  customerEmail: string;
  seats: number;
  isHeld: boolean;
  specialRequests?: string;
  bookingRef?: string;
}

export interface BookingCreationDto {
  restaurantId: number;
  tableId: number;
  sectionId: number;
  customerEmail: string;
  seats: number;
  date: string;
  holdId?: string | null;
  specialRequests?: string | null;
}

export async function createBooking(booking: BookingCreationDto): Promise<BookingDto | null> {
  const res = await post("/bookings", booking);

  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? "This table is no longer available.");
  }

  if (!res.ok) throw new Error("Failed to create booking");
  return await res.json();
}

export async function getBookingById(id: number): Promise<BookingDto | null> {
  try {
    const res = await get(`/bookings/${id}`);
    if (!res.ok) throw new Error("Failed to fetch booking");
    return await res.json();
  } catch (err) {
    console.error("getBookingById error:", err);
    return null;
  }
}

export async function getBookingByRef(
  bookingRef: string,
  email: string
): Promise<BookingDto | null> {
  try {
    const res = await get(`/bookings/ref/${bookingRef}?email=${encodeURIComponent(email)}`);
    if (!res.ok) throw new Error("Failed to fetch booking");
    return await res.json();
  } catch (err) {
    console.error("getBookingByRef error:", err);
    return null;
  }
}

export async function getBookingsByRestaurant(restaurantId: number): Promise<BookingDto[]> {
  try {
    const res = await get(`/bookings/restaurant/${restaurantId}`);
    if (!res.ok) throw new Error("Failed to fetch bookings");
    return await res.json();
  } catch (err) {
    console.error("getBookingsByRestaurant error:", err);
    return [];
  }
}

export async function deleteBooking(id: number): Promise<boolean> {
  try {
    const res = await del(`/bookings/${id}`);
    return res.ok;
  } catch (err) {
    console.error("deleteBooking error:", err);
    return false;
  }
}
