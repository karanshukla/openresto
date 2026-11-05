import { RestaurantDto } from "@/api/restaurants";
import { BookingDto, createBooking } from "@/api/bookings";
import { rememberBooking } from "@/utils/bookingCache";
import { convertLocalToUtc } from "@/utils/date";
import type { BookingFormData } from "./BookingForm";

/**
 * Turns a filled-in booking form into a booking, shared by the Locations drawer and the
 * embedded widget. For "Any section" (null tableId/sectionId) the server auto-assigns the best
 * table; for an explicit table without a section, the table's owning section is sent.
 */
export async function submitBooking(
  restaurant: RestaurantDto,
  data: BookingFormData
): Promise<BookingDto | null> {
  const dateTime = convertLocalToUtc(data.date, data.time, restaurant.timezone || "UTC");
  const resolvedSectionId =
    data.sectionId ??
    (data.tableId !== null
      ? (restaurant.sections.find((s) => s.tables.some((t) => t.id === data.tableId))?.id ?? null)
      : null);

  const booking = await createBooking({
    customerEmail: data.customerEmail,
    customerName: data.customerName,
    seats: data.seats,
    tableId: data.tableId,
    tableGroupId: data.tableGroupId,
    holdId: data.holdId,
    restaurantId: restaurant.id,
    sectionId: resolvedSectionId,
    date: dateTime,
    specialRequests: data.specialRequests || null,
  });

  if (booking?.bookingRef) {
    // Native has no cookie jar, so the diner's own list of recent bookings is kept
    // client-side; on web this is a no-op and the API's HttpOnly cookie still owns it.
    rememberBooking({
      bookingRef: booking.bookingRef,
      email: data.customerEmail,
      date: dateTime,
      seats: data.seats,
      restaurantName: restaurant.name,
      createdAt: new Date().toISOString(),
    });
  }
  return booking;
}
