import { useEffect } from "react";
import { useWaitlistEntry } from "./useWaitlistEntry";
import WaitlistTicket from "./WaitlistTicket";

/**
 * A waitlist ticket in My bookings' result panel, where the "table ready" email's
 * `/waitlist/<ref>` link also lands. `onLoaded` hands back the ticket's location once it is
 * known, so a ticket opened from a link joins the device's list like one joined here.
 *
 * @see [WaitlistTicketPanel.test.tsx](../../tests/components/waitlist/WaitlistTicketPanel.test.tsx)
 */
export default function WaitlistTicketPanel({
  entryRef,
  onLoaded,
}: {
  entryRef: string;
  onLoaded: (restaurantId: number) => void;
}) {
  const state = useWaitlistEntry(entryRef);
  const restaurantId = state.entry?.restaurantId;

  useEffect(() => {
    if (restaurantId !== undefined) onLoaded(restaurantId);
  }, [restaurantId, onLoaded]);

  return <WaitlistTicket state={state} />;
}
