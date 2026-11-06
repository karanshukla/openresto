import type { RestaurantDto } from "@/api/restaurants";

/**
 * Shared helpers for a location's online booking limits: how far ahead a guest may book and
 * which party sizes the online form takes. The server enforces all of it (availability, holds
 * and booking create); these mirror the rules so the date picker and party size control never
 * offer what the server would then refuse. Minimum notice has no mirror: the server marks the
 * slots inside it unavailable, which is all the form needs.
 */

export type BookingLimitsSource = Pick<
  RestaurantDto,
  "maxBookingDaysAhead" | "minOnlinePartySize" | "maxOnlinePartySize"
>;

/** How many days past today the date picker offers when the location sets no horizon. */
export const DEFAULT_PICKER_DAYS_AHEAD = 29;

/** The largest party the picker lists when the location sets no online maximum. */
export const DEFAULT_MAX_PARTY_OPTION = 10;

/**
 * How many days past today the booking date picker should offer: the location's horizon when
 * it has one (so a 60-day horizon reaches two months and a 7-day one stops at a week),
 * otherwise the picker's own default month.
 *
 * @see [bookingLimits.test.ts](../tests/utils/bookingLimits.test.ts) — pins that a horizon
 * both shortens and lengthens the default window, and that 0 leaves today only.
 */
export function pickerDaysAhead(restaurant: BookingLimitsSource): number {
  return restaurant.maxBookingDaysAhead ?? DEFAULT_PICKER_DAYS_AHEAD;
}

export function minOnlinePartySize(restaurant: BookingLimitsSource): number {
  return restaurant.minOnlinePartySize ?? 1;
}

/**
 * The party sizes the guest form lists: the online range when the location caps it, with one
 * extra "N+" entry past the cap so a bigger party can say so and be pointed at the phone
 * rather than finding the number missing; the first ten sizes otherwise.
 *
 * @see [bookingLimits.test.ts](../tests/utils/bookingLimits.test.ts) — pins the range, the
 * one-past-the-cap entry and the default list.
 */
export function partySizeOptions(restaurant: BookingLimitsSource): number[] {
  const min = minOnlinePartySize(restaurant);
  const max = restaurant.maxOnlinePartySize;
  const last = max == null ? Math.max(DEFAULT_MAX_PARTY_OPTION, min) : max + 1;
  const sizes: number[] = [];
  for (let size = min; size <= last; size++) sizes.push(size);
  return sizes;
}

/** True when `seats` is more than the location takes online, so the form shows the contact prompt. */
export function isPartyAboveOnlineMax(restaurant: BookingLimitsSource, seats: number): boolean {
  return restaurant.maxOnlinePartySize != null && seats > restaurant.maxOnlinePartySize;
}

/** True when `seats` is fewer than the location takes online. */
export function isPartyBelowOnlineMin(restaurant: BookingLimitsSource, seats: number): boolean {
  return seats < minOnlinePartySize(restaurant);
}

/** The nearest party size the location takes online, for a default the limits would refuse. */
export function clampPartySize(restaurant: BookingLimitsSource, seats: number): number {
  const min = minOnlinePartySize(restaurant);
  const max = restaurant.maxOnlinePartySize;
  if (seats < min) return min;
  if (max != null && seats > max) return max;
  return seats;
}
