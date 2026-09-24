import { StorageService } from "@/services/storage";

/** The guest's waitlist ticket ref at each location, keyed by restaurant id. */
export type WaitlistTickets = Record<number, string>;

const STORAGE_KEY = "openresto.waitlistTickets";

/**
 * The tickets this device holds. The Locations panel reopens a location's ticket from here and
 * My bookings lists them all, so both read storage rather than a copy either screen keeps:
 * native keeps every tab mounted, and a copy read at mount goes stale behind the other tab.
 *
 * @see [waitlistTickets.test.ts](../tests/utils/waitlistTickets.test.ts)
 */
export function readWaitlistTickets(): WaitlistTickets {
  const raw = StorageService.getItem(STORAGE_KEY);
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as WaitlistTickets)
      : {};
  } catch {
    return {};
  }
}

function write(tickets: WaitlistTickets): WaitlistTickets {
  StorageService.setItem(STORAGE_KEY, JSON.stringify(tickets));
  return tickets;
}

/** Keeps a location's ticket, replacing the one it had. Returns the tickets now held. */
export function rememberWaitlistTicket(restaurantId: number, entryRef: string): WaitlistTickets {
  return write({ ...readWaitlistTickets(), [restaurantId]: entryRef });
}

export function forgetWaitlistTicket(restaurantId: number): WaitlistTickets {
  const next = readWaitlistTickets();
  delete next[restaurantId];
  return write(next);
}
