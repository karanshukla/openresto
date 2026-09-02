import { StorageService } from "@/services/storage";

const STORAGE_KEY = "openresto.reminders";

/**
 * Which bookings this device asked to be reminded about, keyed by reference, holding the push
 * address it registered with. The server has no way to answer "is this device subscribed"
 * without being handed the address, so the device remembers on its own; the address is what
 * an opt-out sends back.
 *
 * @see [reminderRegistry.test.ts](../tests/utils/reminderRegistry.test.ts) — pins that a
 * corrupt store reads as empty and that forgetting one booking leaves the others.
 */
function read(): Record<string, string> {
  const raw = StorageService.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

export function reminderEndpointFor(bookingRef: string): string | null {
  return read()[bookingRef] ?? null;
}

export function rememberReminder(bookingRef: string, endpoint: string): void {
  StorageService.setItem(STORAGE_KEY, JSON.stringify({ ...read(), [bookingRef]: endpoint }));
}

export function forgetReminder(bookingRef: string): void {
  const { [bookingRef]: _removed, ...rest } = read();
  StorageService.setItem(STORAGE_KEY, JSON.stringify(rest));
}
