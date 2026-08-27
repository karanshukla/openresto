import { get, post, del } from "./client";
import { apiErrorMessage } from "@/api/errors";

export interface BookingDto {
  id: number;
  tableId: number | null;
  sectionId: number | null;
  /**
   * Combinable-table group id when this booking reserves a merged group of tables (#272); null for
   * a single-table booking. Mutually exclusive with tableId. When set, tableName carries the group
   * label (e.g. "Tables 8 + 9") and tableSeats carries the group's combined capacity.
   */
  tableGroupId?: number | null;
  restaurantId: number;
  date: string;
  endTime?: string;
  customerEmail: string;
  customerName?: string;
  seats: number;
  isHeld: boolean;
  specialRequests?: string;
  bookingRef?: string;
  tableName?: string;
  sectionName?: string;
  tableSeats?: number;
  isCancelled?: boolean;
}

export interface BookingCreationDto {
  restaurantId: number;
  /** Omit (or null) for "Any section" auto-assign — the server picks the best table. */
  tableId: number | null;
  /** Omit (or null) for "Any section" auto-assign. */
  sectionId: number | null;
  /**
   * Combinable-table group id (#274) when booking a combined group; null otherwise. Mutually
   * exclusive with tableId.
   */
  tableGroupId?: number | null;
  customerEmail: string;
  customerName: string;
  seats: number;
  date: string;
  holdId?: string | null;
  specialRequests?: string | null;
}

/** Normalize PascalCase API responses to camelCase BookingDto */
function normalizeBooking(raw: Record<string, unknown>): BookingDto {
  return {
    id: (raw.id ?? raw.Id) as number,
    tableId: (raw.tableId ?? raw.TableId ?? null) as number | null,
    sectionId: (raw.sectionId ?? raw.SectionId ?? null) as number | null,
    tableGroupId: (raw.tableGroupId ?? raw.TableGroupId ?? null) as number | null,
    restaurantId: (raw.restaurantId ?? raw.RestaurantId) as number,
    date: (raw.date ?? raw.Date) as string,
    endTime: (raw.endTime ?? raw.EndTime) as string | undefined,
    customerEmail: (raw.customerEmail ?? raw.CustomerEmail) as string,
    customerName: (raw.customerName ?? raw.CustomerName) as string | undefined,
    seats: (raw.seats ?? raw.Seats) as number,
    isHeld: (raw.isHeld ?? raw.IsHeld ?? false) as boolean,
    specialRequests: (raw.specialRequests ?? raw.SpecialRequests) as string | undefined,
    bookingRef: (raw.bookingRef ?? raw.BookingRef) as string | undefined,
    tableName: (raw.tableName ?? raw.TableName) as string | undefined,
    sectionName: (raw.sectionName ?? raw.SectionName) as string | undefined,
    tableSeats: (raw.tableSeats ?? raw.TableSeats) as number | undefined,
    isCancelled: (raw.isCancelled ?? raw.IsCancelled) as boolean | undefined,
  };
}

export async function createBooking(booking: BookingCreationDto): Promise<BookingDto | null> {
  const res = await post("/bookings", booking);

  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    throw new Error(apiErrorMessage(body, "This table is no longer available."));
  }

  if (!res.ok) throw new Error("Failed to create booking");
  return normalizeBooking(await res.json());
}

export async function getBookingById(id: number): Promise<BookingDto | null> {
  try {
    const res = await get(`/bookings/${id}`);
    if (!res.ok) throw new Error("Failed to fetch booking");
    return normalizeBooking(await res.json());
  } catch (err) {
    console.error("getBookingById error:", err);
    return null;
  }
}

/**
 * Looks up a booking by reference and email. Returns null only for a genuine
 * "no booking matches" (the backend 404s for both an unknown ref and a
 * ref/email mismatch, deliberately not distinguishing the two). Anything
 * else — a 5xx, a timeout, a network failure — throws instead of also
 * collapsing to null, so callers can tell "this booking doesn't exist" apart
 * from "we couldn't check" rather than showing the same not-found copy for both.
 */
export async function getBookingByRef(
  bookingRef: string,
  email: string
): Promise<BookingDto | null> {
  const res = await get(`/bookings/ref/${bookingRef}?email=${encodeURIComponent(email)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch booking");
  return normalizeBooking(await res.json());
}

export async function getBookingsByRestaurant(restaurantId: number): Promise<BookingDto[]> {
  try {
    const res = await get(`/restaurants/${restaurantId}/bookings`);
    if (!res.ok) throw new Error("Failed to fetch bookings");
    const data: Record<string, unknown>[] = await res.json();
    return data.map(normalizeBooking);
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

export async function cancelBookingByRef(bookingRef: string, email: string): Promise<true> {
  try {
    const res = await post(`/bookings/ref/${bookingRef}/cancel`, { email });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(apiErrorMessage(body, "Failed to cancel booking."));
    }
    return true;
  } catch (err) {
    console.error("cancelBookingByRef error:", err);
    throw err;
  }
}
