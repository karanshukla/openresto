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
  tableName?: string;
  sectionName?: string;
  tableSeats?: number;
  isCancelled?: boolean;
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

/** Normalize PascalCase API responses to camelCase BookingDto */
function normalizeBooking(raw: Record<string, unknown>): BookingDto {
  return {
    id: (raw.id ?? raw.Id) as number,
    tableId: (raw.tableId ?? raw.TableId) as number,
    sectionId: (raw.sectionId ?? raw.SectionId) as number,
    restaurantId: (raw.restaurantId ?? raw.RestaurantId) as number,
    date: (raw.date ?? raw.Date) as string,
    customerEmail: (raw.customerEmail ?? raw.CustomerEmail) as string,
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
    throw new Error(body.message ?? "This table is no longer available.");
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

export async function getBookingByRef(
  bookingRef: string,
  email: string
): Promise<BookingDto | null> {
  try {
    const res = await get(`/bookings/ref/${bookingRef}?email=${encodeURIComponent(email)}`);
    if (!res.ok) throw new Error("Failed to fetch booking");
    return normalizeBooking(await res.json());
  } catch (err) {
    console.error("getBookingByRef error:", err);
    return null;
  }
}

export async function getBookingsByRestaurant(restaurantId: number): Promise<BookingDto[]> {
  try {
    const res = await get(`/bookings/restaurant/${restaurantId}`);
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

export async function cancelBookingByRef(bookingRef: string, email: string): Promise<boolean> {
  try {
    const res = await del(`/bookings/ref/${bookingRef}?email=${encodeURIComponent(email)}`);
    return res.ok;
  } catch (err) {
    console.error("cancelBookingByRef error:", err);
    return false;
  }
}
