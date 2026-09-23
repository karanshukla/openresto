import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import Button from "@/components/common/Button";
import { ButtonRow } from "@/components/common/ButtonRow";
import JoinWaitlistForm from "./JoinWaitlistForm";
import { useWaitlistEntry } from "./useWaitlistEntry";
import WaitlistTicket from "./WaitlistTicket";
import { styles } from "./WaitlistPanel.styles";

/**
 * The waitlist inside the Locations page's panel: the join form, then the guest's ticket in the
 * same place once they are in. The ticket's own page stays one press away, since the panel
 * closes and the email only arrives once the table is ready.
 *
 * @see [WaitlistPanel.test.tsx](../../tests/components/waitlist/WaitlistPanel.test.tsx): pins
 * the swap to the ticket on joining and the way back to the form once the ticket has closed.
 */
export default function WaitlistPanel({
  restaurantId,
  seats,
  onSeatsChange,
  entryRef,
  onJoined,
  onReset,
}: {
  restaurantId: number;
  seats: number;
  onSeatsChange: (seats: number) => void;
  /** The guest's ticket at this location, once they have joined. */
  entryRef?: string;
  onJoined: (entryRef: string) => void;
  /** Forgets a ticket that has left the queue, so the guest can join again. */
  onReset: () => void;
}) {
  if (!entryRef) {
    return (
      <JoinWaitlistForm
        restaurantId={restaurantId}
        seats={seats}
        onSeatsChange={onSeatsChange}
        onJoined={onJoined}
      />
    );
  }
  return <JoinedTicket entryRef={entryRef} onReset={onReset} />;
}

function JoinedTicket({ entryRef, onReset }: { entryRef: string; onReset: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const state = useWaitlistEntry(entryRef);
  const closed = state.entry !== undefined && !state.queued;

  return (
    <View style={styles.root}>
      <WaitlistTicket state={state} />
      {/* Centred under the ticket, which centres its own copy. */}
      <ButtonRow align="center">
        {closed ? (
          <Button variant="secondary" size="md" onPress={onReset} testID="waitlist-join-again">
            {t("booking.waitlist.joinAgain")}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="md"
            icon="open-outline"
            onPress={() => router.push(`/waitlist/${entryRef}`)}
            testID="waitlist-open-ticket"
          >
            {t("booking.waitlist.openTicket")}
          </Button>
        )}
      </ButtonRow>
    </View>
  );
}
