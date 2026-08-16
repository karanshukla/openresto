import { useCallback, useState } from "react";
import { getBookingByRef, getBookingById, cancelBookingByRef, BookingDto } from "@/api/bookings";
import { fetchRestaurantById, RestaurantDto } from "@/api/restaurants";
import { useErrorHandler } from "@/hooks/useErrorHandler";

export type BookingLookupStatus = "idle" | "loading" | "found" | "notFound" | "error";

export type LookupOutcome =
  { status: "found"; booking: BookingDto } | { status: "notFound" | "error" };

interface LookupOptions {
  /**
   * Legacy /booking-confirmation/<id> links predate booking references entirely. When the
   * ref+email lookup 404s (or there's no email to gate it with at all — those old links never
   * carried one), this numeric id is tried as a fallback. Admin-only server-side, so it only
   * ever resolves for links minted before references existed.
   */
  legacyId?: number;
}

/**
 * Booking + restaurant state, and the cancel flow, shared by every door into the lookup
 * screen — the plain form, a `?ref=&email=` deep link, a recent-booking tap, and
 * /booking-confirmation/[bookingRef] — since they all resolve to the same result panel.
 */
export function useBookingLookup() {
  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantDto | null>(null);
  const [status, setStatus] = useState<BookingLookupStatus>("idle");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { errorMessage, showError, clearError } = useErrorHandler();

  const lookup = useCallback(async (ref: string, email: string, opts?: LookupOptions) => {
    setStatus("loading");
    setRestaurant(null);
    try {
      let result: BookingDto | null = null;
      if (email) {
        result = await getBookingByRef(ref, email);
      }
      if (!result && opts?.legacyId !== undefined) {
        result = await getBookingById(opts.legacyId);
      }
      if (!result) {
        setBooking(null);
        setStatus("notFound");
        return { status: "notFound" } satisfies LookupOutcome;
      }
      setBooking(result);
      setStatus("found");
      if (result.restaurantId) {
        const r = await fetchRestaurantById(result.restaurantId);
        setRestaurant(r);
      }
      return { status: "found", booking: result } satisfies LookupOutcome;
    } catch {
      setBooking(null);
      setStatus("error");
      return { status: "error" } satisfies LookupOutcome;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setBooking(null);
    setRestaurant(null);
  }, []);

  const cancelBooking = useCallback(async () => {
    if (!booking?.bookingRef) return;
    setCancelling(true);
    try {
      await cancelBookingByRef(booking.bookingRef, booking.customerEmail ?? "");
      setBooking((prev) => (prev ? { ...prev, isCancelled: true } : prev));
      setShowCancelConfirm(false);
    } catch (err) {
      showError(err);
    } finally {
      setCancelling(false);
    }
  }, [booking, showError]);

  return {
    booking,
    restaurant,
    status,
    lookup,
    reset,
    showCancelConfirm,
    setShowCancelConfirm,
    cancelling,
    cancelBooking,
    errorMessage,
    clearError,
  };
}
