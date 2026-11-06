import { useEffect, useState } from "react";
import { fetchAvailability, TimeSlotDto } from "@/api/availability";
import { isWalkInOnlyOnDate } from "@/utils/walkIn";
import { isOpenOnDate } from "@/utils/openingHours";
import { isPartyAboveOnlineMax, isPartyBelowOnlineMin } from "@/utils/bookingLimits";
import type { RestaurantDto } from "@/api/restaurants";

export interface UseBookingAvailabilityArgs {
  restaurant: RestaurantDto;
  date: string;
  seats: number;
  time: string;
  /** Called when the picked time isn't bookable and the first available one takes its place. */
  onTimeCorrected: (time: string) => void;
}

/**
 * Availability for the booking form's current (date, party size).
 *
 * Closed and walk-in-only dates, and a party outside the online size limits, short-circuit to
 * an empty list rather than a request — the server would return no slots for them anyway, and
 * the form renders its own notice instead. The date is judged as a date, not a weekday, so a
 * closed date exception or a special-hours Sunday is answered the way the server answers it.
 *
 * @see [useBookingAvailability.test.tsx](../../tests/components/booking/useBookingAvailability.test.tsx)
 * — pins that a closed date and a party over the online maximum fetch nothing.
 */
export function useBookingAvailability({
  restaurant,
  date,
  seats,
  time,
  onTimeCorrected,
}: UseBookingAvailabilityArgs) {
  const [availabilitySlots, setAvailabilitySlots] = useState<TimeSlotDto[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  useEffect(() => {
    if (
      date &&
      (!isOpenOnDate(restaurant, date) ||
        isWalkInOnlyOnDate(restaurant, date) ||
        isPartyAboveOnlineMax(restaurant, seats) ||
        isPartyBelowOnlineMin(restaurant, seats))
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvailabilitySlots([]);
      setLoadingAvailability(false);
      return;
    }
    async function loadAvailability() {
      setLoadingAvailability(true);
      try {
        const res = await fetchAvailability(restaurant.id, date, seats);
        if (res && res.slots) {
          setAvailabilitySlots(res.slots);
          const isCurrentValid = res.slots.find((s) => s.time === time && s.isAvailable);
          if (!isCurrentValid) {
            const firstAvail = res.slots.find((s) => s.isAvailable);
            if (firstAvail) {
              onTimeCorrected(firstAvail.time);
            }
          }
        } else {
          setAvailabilitySlots([]);
        }
      } finally {
        setLoadingAvailability(false);
      }
    }
    loadAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, seats, restaurant.id]);

  return { availabilitySlots, loadingAvailability };
}
