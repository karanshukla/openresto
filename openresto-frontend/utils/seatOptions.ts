/**
 * Seat-count dropdown options shared by every seats/capacity picker (admin table editor, add-table
 * form, combinable-group combined-seats editor). Matches the backend BookingLimits bounds so the
 * frontend can never offer a value the server will reject — see OpenRestoApi BookingLimits.cs.
 */
export const MIN_SEATS = 1;
export const MAX_SEATS = 50;

export interface SeatOption {
  label: string;
  value: number;
}

/**
 * Build seat-count options from `min` (inclusive) to `max` (inclusive). Defaults to the global
 * [MIN_SEATS, MAX_SEATS] range; callers can narrow it (e.g. a group's combined-seats editor may
 * want a floor above the sum of member seats).
 */
export function buildSeatOptions(min: number = MIN_SEATS, max: number = MAX_SEATS): SeatOption[] {
  const options: SeatOption[] = [];
  for (let i = min; i <= max; i++) {
    options.push({ label: `${i} seat${i === 1 ? "" : "s"}`, value: i });
  }
  return options;
}
