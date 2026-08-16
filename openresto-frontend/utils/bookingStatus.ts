/**
 * Whether a booking's date/time has already passed, using the same 5-minute
 * clock-skew grace window as the backend's create/cancel guards
 * (BookingService.cs and AdminService.cs both enforce this independently —
 * keep all three in sync if the window ever changes). Shared by the admin
 * bookings table and the customer-facing lookup/confirmation screens, so
 * neither reaches into the other's module to get at it.
 */
export function isPast(date: string): boolean {
  return new Date(date).getTime() < Date.now() - 5 * 60 * 1000;
}
