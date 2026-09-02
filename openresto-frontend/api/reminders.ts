import { del, post } from "./client";

export type ReminderChannel = "expo" | "webpush";

/** The address a reminder is delivered to: an Expo push token, or a browser's Web Push subscription. */
export interface ReminderRegistration {
  channel: ReminderChannel;
  endpoint: string;
  p256dh?: string;
  auth?: string;
}

function reminderPath(bookingRef: string): string {
  return `/bookings/ref/${encodeURIComponent(bookingRef)}/reminders`;
}

/**
 * Asks the server to remind this device about a booking. The reference and the email are the
 * guest's identity, as on lookup; a wrong pair is a 404 the caller reports as a plain failure.
 *
 * @see [reminders.test.ts](../tests/api/reminders.test.ts) — pins the body shape and that a
 * non-2xx answers `false` rather than throwing.
 */
export async function subscribeReminder(
  bookingRef: string,
  email: string,
  registration: ReminderRegistration,
  locale: string
): Promise<boolean> {
  try {
    const res = await post(reminderPath(bookingRef), { email, locale, ...registration });
    return res.ok;
  } catch (err) {
    console.error("subscribeReminder error:", err);
    return false;
  }
}

export async function unsubscribeReminder(
  bookingRef: string,
  email: string,
  endpoint: string
): Promise<boolean> {
  try {
    const res = await del(reminderPath(bookingRef), { body: { email, endpoint } });
    return res.ok;
  } catch (err) {
    console.error("unsubscribeReminder error:", err);
    return false;
  }
}
