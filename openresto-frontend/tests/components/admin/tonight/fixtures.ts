import type { BookingDetailDto } from "@/api/admin";
import type { FloorUnit } from "@/api/tonight";

export const NOW = Date.parse("2026-11-05T19:00:00Z");
export const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

export const booking = (over: Partial<BookingDetailDto> = {}): BookingDetailDto => ({
  id: 1,
  restaurantId: 1,
  restaurantName: "Flagship",
  sectionId: 1,
  sectionName: "Main",
  tableId: 3,
  tableName: "T3",
  date: at(0),
  customerEmail: "maya@example.com",
  customerName: "Maya",
  seats: 2,
  status: "Booked",
  nextStatuses: ["Arrived", "Seated"],
  undoStatus: null,
  ...over,
});

export const unit = (over: Partial<FloorUnit> = {}): FloorUnit => ({
  kind: "table",
  id: 3,
  name: "T3",
  seats: 4,
  walkInOnly: false,
  memberTableIds: [],
  state: "free",
  currentBookingId: null,
  currentEndsAt: null,
  nextBookingId: null,
  nextBookingAt: null,
  ...over,
});
