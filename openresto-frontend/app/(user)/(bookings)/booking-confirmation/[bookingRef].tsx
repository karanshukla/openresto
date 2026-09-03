import { useLocalSearchParams } from "expo-router";
import LookupScreen from "@/components/booking/LookupScreen";

/**
 * Booking confirmation is a state of the lookup screen, not a page of its own — this route
 * exists because it's the link every confirmation email already sent points at, and it has
 * to keep working. It mounts LookupScreen with the ref/email prefilled from the URL and
 * `justBooked` set, so it lands straight on the same result panel /lookup shows, with one
 * different header line ("Booking Confirmed" instead of "Booking Found").
 *
 * The path segment predates booking references (#179): a numeric one is tried as a
 * reference first (references can themselves be all-digits) and, if that comes back
 * not-found, as a legacy /booking-confirmation/<id> link.
 */
export default function BookingConfirmationRouteScreen() {
  const { bookingRef, email } = useLocalSearchParams<{ bookingRef: string; email?: string }>();
  const legacyBookingId = /^\d+$/.test(bookingRef ?? "") ? parseInt(bookingRef, 10) : undefined;

  return (
    <LookupScreen
      initialRef={bookingRef}
      initialEmail={email || undefined}
      legacyBookingId={legacyBookingId}
      justBooked
    />
  );
}
