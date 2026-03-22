import { Platform } from "react-native";

export interface CachedBooking {
  bookingRef: string;
  email: string;
  date: string;
  seats: number;
  restaurantName?: string;
  createdAt: string; // ISO string
}

const STORAGE_KEY = "openresto_bookings";
const MAX_CACHED = 20;

function getStorage(): Storage | null {
  if (Platform.OS !== "web") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getCachedBookings(): CachedBooking[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const bookings: CachedBooking[] = JSON.parse(raw);
    // Sort newest first
    return bookings.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

export function addCachedBooking(booking: Omit<CachedBooking, "createdAt">) {
  const storage = getStorage();
  if (!storage) return;
  const existing = getCachedBookings();
  // Don't duplicate
  if (existing.some((b) => b.bookingRef === booking.bookingRef)) return;
  const updated = [{ ...booking, createdAt: new Date().toISOString() }, ...existing].slice(
    0,
    MAX_CACHED
  );
  storage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function removeCachedBooking(bookingRef: string) {
  const storage = getStorage();
  if (!storage) return;
  const existing = getCachedBookings();
  const updated = existing.filter((b) => b.bookingRef !== bookingRef);
  storage.setItem(STORAGE_KEY, JSON.stringify(updated));
}
