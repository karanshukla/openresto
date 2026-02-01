
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
}

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export async function createBooking(
  booking: BookingCreationDto
): Promise<BookingDto | null> {
  try {
    const base = API_URL?.replace(/\/$/, "") ?? "";
    const endpoint = base
      ? base.includes("/api")
        ? `${base}/bookings`
        : `${base}/api/bookings`
      : "/api/bookings";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(booking),
    });

    if (!res.ok) {
      throw new Error("Failed to create booking");
    }

    return await res.json();
  } catch (err) {
    console.error("createBooking error:", err);
    return null;
  }
}

export async function getBookingById(
  id: number
): Promise<BookingDto | null> {
  try {
    const base = API_URL?.replace(/\/$/, "") ?? "";
    const endpoint = base
      ? base.includes("/api")
        ? `${base}/bookings/${id}`
        : `${base}/api/bookings/${id}`
      : `/api/bookings/${id}`;

    const res = await fetch(endpoint);
    if (!res.ok) throw new Error("Failed to fetch booking");

    return await res.json();
  } catch (err) {
    console.error("getBookingById error:", err);
    return null;
  }
}
