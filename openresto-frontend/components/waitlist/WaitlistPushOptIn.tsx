import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import ButtonRow from "@/components/common/ButtonRow";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useBrand } from "@/context/BrandContext";
import type { ReminderRegistration } from "@/api/reminders";
import { canRegisterForReminders, registerForReminders } from "@/services/pushRegistration";
import { styles } from "./WaitlistPushOptIn.styles";

/**
 * The join form's "notify me" pill. The press asks for the OS permission and mints this
 * device's push address right then, because a browser only prompts in answer to a press; the
 * form hands the address to the ticket once the guest has joined. Renders nothing where this
 * device cannot be pushed (no VAPID key on the server, a browser without the Push API, Expo Go).
 *
 * @see [WaitlistPushOptIn.test.tsx](../../tests/components/waitlist/WaitlistPushOptIn.test.tsx):
 * pins the hidden-when-unsupported rule, the hand-off of the address, and the denied copy.
 */
export default function WaitlistPushOptIn({
  registration,
  onChange,
}: {
  registration: ReminderRegistration | null;
  onChange: (registration: ReminderRegistration | null) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { webPushPublicKey } = useBrand();
  const [pending, setPending] = useState<"busy" | "denied" | null>(null);

  if (!canRegisterForReminders({ webPushPublicKey })) return null;

  const on = registration !== null;

  const toggle = async () => {
    if (on) {
      onChange(null);
      return;
    }
    setPending("busy");
    const result = await registerForReminders({ webPushPublicKey });
    setPending(result.status === "denied" ? "denied" : null);
    if (result.status === "registered") onChange(result.registration);
  };

  const note =
    pending === "denied"
      ? t("booking.waitlist.push.denied")
      : on
        ? t("booking.waitlist.push.onHint")
        : t("booking.waitlist.push.offHint");

  return (
    <View style={styles.wrap} testID="waitlist-push">
      <ButtonRow align="start">
        <Button
          testID="waitlist-push-btn"
          variant="secondary"
          tone={on ? "success" : "brand"}
          size="sm"
          icon={on ? "notifications" : "notifications-outline"}
          loading={pending === "busy"}
          disabled={pending === "denied"}
          onPress={() => void toggle()}
          accessibilityState={{ checked: on }}
        >
          {on ? t("booking.waitlist.push.onButton") : t("booking.waitlist.push.offButton")}
        </Button>
      </ButtonRow>
      <ThemedText style={[styles.note, { color: colors.muted }]}>{note}</ThemedText>
    </View>
  );
}
