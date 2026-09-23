import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { EmailField, GuestsField, NameField } from "@/components/booking/BookingFormFields";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLocale } from "@/context/LocaleContext";
import { getWaitlistQuote, joinWaitlist, type WaitlistQuote } from "@/api/waitlist";
import { isValidEmail } from "@/utils/validation";
import WaitEstimate from "./WaitEstimate";
import { styles } from "./JoinWaitlistForm.styles";

const PARTY_SIZES = 10;

/**
 * Joining the walk-in queue. The quote re-fetches as the party size changes, so the guest sees
 * the wait they are signing up for before they commit. Whether the queue is open is the
 * server's call (walk-in only and open right now); this form only reflects it. Party size is
 * the page's, like the booking form's.
 *
 * @see [JoinWaitlistForm.test.tsx](../../tests/components/waitlist/JoinWaitlistForm.test.tsx):
 * pins the closed state, the requote on a size change, and the hand-off of the new ticket.
 */
export default function JoinWaitlistForm({
  restaurantId,
  seats,
  onSeatsChange,
  onJoined,
}: {
  restaurantId: number;
  seats: number;
  onSeatsChange: (seats: number) => void;
  onJoined: (entryRef: string) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { locale } = useLocale();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [quote, setQuote] = useState<WaitlistQuote | null | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getWaitlistQuote(restaurantId, seats).then((q) => {
      if (live) setQuote(q);
    });
    return () => {
      live = false;
    };
  }, [restaurantId, seats]);

  const trimmedEmail = email.trim();
  const canSubmit =
    !submitting && name.trim().length > 0 && (trimmedEmail === "" || isValidEmail(trimmedEmail));

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const result = await joinWaitlist(restaurantId, {
      name: name.trim(),
      seats,
      email: trimmedEmail || undefined,
      locale,
    });
    setSubmitting(false);
    if (result.ok) {
      onJoined(result.value.ref);
    } else {
      setError(result.message);
    }
  };

  const seatOptions = Array.from({ length: PARTY_SIZES }, (_, i) => ({
    label: t("booking.form.seatsCount", { count: i + 1 }),
    value: i + 1,
  }));

  if (quote === undefined) return <ActivityIndicator testID="waitlist-quote-loading" />;

  if (quote === null) {
    return (
      <ThemedText style={[styles.error, { color: colors.error }]}>
        {t("booking.waitlist.loadFailed")}
      </ThemedText>
    );
  }

  if (!quote.acceptingGuests) {
    return (
      <ThemedText testID="waitlist-closed" style={[styles.intro, { color: colors.muted }]}>
        {t("booking.waitlist.notAccepting")}
      </ThemedText>
    );
  }

  return (
    <View style={styles.form}>
      <ThemedText style={[styles.intro, { color: colors.muted }]}>
        {t("booking.waitlist.intro")}
      </ThemedText>
      <View
        testID="waitlist-quote"
        style={[styles.quote, { borderColor: colors.border, backgroundColor: colors.card }]}
      >
        <ThemedText style={styles.quoteLine}>
          <WaitEstimate minutes={quote.estimatedWaitMinutes} />
        </ThemedText>
        <ThemedText style={{ color: colors.muted }}>
          {t("booking.waitlist.partiesWaiting", { count: quote.partiesWaiting })}
        </ThemedText>
      </View>
      <GuestsField
        label={t("booking.waitlist.partySizeLabel")}
        seats={seats}
        options={seatOptions}
        onChange={onSeatsChange}
      />
      <NameField value={name} onChange={setName} />
      <EmailField value={email} onChange={setEmail} />
      <ThemedText style={[styles.hint, { color: colors.muted }]}>
        {t("booking.waitlist.emailHint")}
      </ThemedText>
      {error && (
        <ThemedText testID="waitlist-join-error" style={[styles.error, { color: colors.error }]}>
          {error}
        </ThemedText>
      )}
      <Button
        size="lg"
        fullWidth
        loading={submitting}
        disabled={!canSubmit || quote.estimatedWaitMinutes === null}
        onPress={submit}
        testID="waitlist-join-submit"
      >
        {t("booking.waitlist.submit")}
      </Button>
    </View>
  );
}
