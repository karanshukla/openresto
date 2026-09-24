import { useEffect } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useWaitlistEntry } from "./useWaitlistEntry";
import WaitlistTicket from "./WaitlistTicket";

/**
 * The device's waitlist tickets on My Bookings, apart from the booking lookup. Only a ticket
 * still in the queue shows: one that has closed, or that the server no longer knows, renders
 * nothing and is handed to `onClosed` so the device forgets it. `onLoaded` hands back each live
 * ticket's location, so one opened from the "table ready" link is kept like one joined here.
 * That linked ticket also shows while it loads and when it fails or is not found, as a booking
 * link does, so the page the link opens is never silently blank.
 *
 * @see [ActiveWaitlistTickets.test.tsx](../../tests/components/waitlist/ActiveWaitlistTickets.test.tsx)
 * — pins that a closed or unknown ticket shows nothing and is forgotten, unless it is the
 * linked one.
 */
export default function ActiveWaitlistTickets({
  entryRefs,
  linkedRef,
  onLoaded,
  onClosed,
  style,
}: {
  entryRefs: string[];
  /** The ticket the page was opened for, from the "table ready" link. */
  linkedRef?: string;
  onLoaded: (restaurantId: number, entryRef: string) => void;
  onClosed: (entryRef: string) => void;
  /** Applied to each ticket, so no space is left behind when none is live. */
  style?: StyleProp<ViewStyle>;
}) {
  return entryRefs.map((entryRef) => (
    <ActiveTicket
      key={entryRef}
      entryRef={entryRef}
      linked={entryRef === linkedRef}
      onLoaded={onLoaded}
      onClosed={onClosed}
      style={style}
    />
  ));
}

function ActiveTicket({
  entryRef,
  linked,
  onLoaded,
  onClosed,
  style,
}: {
  entryRef: string;
  linked: boolean;
  onLoaded: (restaurantId: number, entryRef: string) => void;
  onClosed: (entryRef: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const state = useWaitlistEntry(entryRef);
  const restaurantId = state.entry?.restaurantId;
  const closed = state.entry === null || (state.entry !== undefined && !state.queued);

  useEffect(() => {
    if (closed) onClosed(entryRef);
    else if (restaurantId !== undefined) onLoaded(restaurantId, entryRef);
  }, [closed, restaurantId, entryRef, onLoaded, onClosed]);

  if (!state.queued && !(linked && !state.entry)) return null;
  return (
    <View style={style}>
      <WaitlistTicket state={state} />
    </View>
  );
}
