import { useEffect, useMemo, useState } from "react";
import { fetchAvailability, TimeSlotDto } from "@/api/availability";
import { getRestaurantNow } from "@/utils/restaurantTime";
import type { MealWindow } from "@/components/restaurant/LocationsFilterBar";

export interface UseLocationSlotsArgs {
  restaurantId: number;
  date: string;
  seats: number;
  meal: MealWindow;
  /** False for closed / walk-in-only days: no request goes out and the list stays empty. */
  bookable: boolean;
  /** True when `date` is the restaurant's own today, which is what makes past slots unusable. */
  isToday: boolean;
  /** IANA zone the restaurant keeps its clock in. */
  timezone: string;
  onAvailabilityChange?: (id: number, availableSlots: number | null) => void;
}

/**
 * Availability for one location row, narrowed to the slots a diner could actually take.
 *
 * Refetches whenever the filter bar changes, which is what makes the cards comparable
 * against one another. On today, slots are cut against the *restaurant's* clock rather
 * than the viewer's, so a diner in another timezone doesn't get offered a past table.
 */
export function useLocationSlots({
  restaurantId,
  date,
  seats,
  meal,
  bookable,
  isToday,
  timezone,
  onAvailabilityChange,
}: UseLocationSlotsArgs) {
  const [slots, setSlots] = useState<TimeSlotDto[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);

  useEffect(() => {
    if (!bookable) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlots([]);
      setSlotsLoading(false);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    fetchAvailability(restaurantId, date, seats)
      .then((data) => {
        if (cancelled) return;
        setSlots(data && Array.isArray(data.slots) ? data.slots.filter((s) => s.isAvailable) : []);
        setSlotsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSlots([]);
        setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, date, seats, bookable]);

  const usableSlots = useMemo(() => {
    const inWindow = meal === "All" ? slots : slots.filter((s) => s.category === meal);
    if (!isToday) return inWindow;
    const { totalMins } = getRestaurantNow(timezone);
    return inWindow.filter((s) => {
      const [h, m] = s.time.split(":").map(Number);
      return h * 60 + (m || 0) > totalMins;
    });
  }, [slots, meal, isToday, timezone]);

  useEffect(() => {
    onAvailabilityChange?.(restaurantId, slotsLoading ? null : usableSlots.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, usableSlots.length, slotsLoading]);

  return { slotsLoading, usableSlots };
}
