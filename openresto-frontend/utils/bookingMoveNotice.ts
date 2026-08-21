/**
 * The email an admin sends a guest whose sitting has been moved.
 *
 * Moving a booking and telling the guest were two unrelated steps: the admin edited the booking,
 * then hand-typed an email about it. Nothing carried the old time across, so the message the guest
 * most needs to be exact about was the one most likely to be wrong. This composes it from what
 * actually changed, and the admin still reviews and sends it.
 *
 * Times resolve through the restaurant's timezone, never the browser's. An admin covering a
 * location in another zone would otherwise tell the guest a time nobody is expecting them at, so
 * the zone is named in the text as well: a guest reading "7:00 PM EDT" can act on it, where a bare
 * "7:00 PM" is only as good as an assumption they cannot check.
 *
 * @see [bookingMoveNotice.test.ts](../tests/utils/bookingMoveNotice.test.ts) — pins that the
 * sitting is rendered in the restaurant's zone and that an unchanged sitting composes nothing.
 */
export interface BookingMoveNotice {
  subject: string;
  body: string;
}

export interface BookingMoveDetails {
  restaurantName?: string | null;
  bookingRef?: string | null;
  customerName?: string | null;
  /** ISO instants. The booking's UTC start before and after the edit. */
  fromIso: string;
  toIso: string;
  /** IANA id. Falls back to the browser's zone, which is still labelled in the output. */
  timezone?: string | null;
}

function formatSitting(iso: string, timezone?: string | null): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  };

  try {
    return new Date(iso).toLocaleString(undefined, {
      ...options,
      ...(timezone ? { timeZone: timezone } : {}),
    });
  } catch {
    // An unknown IANA id would otherwise throw and take the whole save handler with it. The
    // browser's zone is wrong for a remote location, but it is labelled, and a notice the admin
    // can correct beats no notice at all.
    return new Date(iso).toLocaleString(undefined, options);
  }
}

/**
 * Null when the sitting did not move, so a rename or a seat-count change never offers the admin
 * an email announcing a change of time that did not happen.
 */
export function composeBookingMoveNotice(details: BookingMoveDetails): BookingMoveNotice | null {
  const from = new Date(details.fromIso);
  const to = new Date(details.toIso);
  if (from.getTime() === to.getTime()) return null;

  const venue = details.restaurantName?.trim() || "the restaurant";
  const greeting = details.customerName?.trim() ? `Hi ${details.customerName.trim()},` : "Hello,";
  const reference = details.bookingRef?.trim()
    ? `\n\nYour booking reference is unchanged: ${details.bookingRef.trim()}.`
    : "";

  return {
    subject: `Your booking at ${venue} has moved`,
    body:
      `${greeting}\n\n` +
      `We have moved your booking at ${venue}.\n\n` +
      `Previously: ${formatSitting(details.fromIso, details.timezone)}\n` +
      `Now: ${formatSitting(details.toIso, details.timezone)}\n\n` +
      `Everything else about the booking stays the same.` +
      reference +
      `\n\nIf the new time does not work for you, reply to this email and we will sort it out.`,
  };
}
