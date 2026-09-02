import React from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import ButtonRow from "@/components/common/ButtonRow";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useBookingReminder } from "@/hooks/use-booking-reminder";
import { styles } from "./ReminderToggle.styles";

interface ReminderToggleProps {
  bookingRef: string;
  email: string;
  /** The card's hairline, rendered above the section only when the section itself renders. */
  separator?: React.ReactNode;
}

/**
 * The "remind me" control on the booking card. One outlined pill that reads as its own state
 * (bell for off, bell-with-check for on), because the two states are the same control and a
 * pair of buttons would make one of them look like a second action. Renders nothing where this
 * device cannot receive reminders, so a web visitor with no push keys on the server never sees
 * a toggle that could not work.
 *
 * @see [ReminderToggle.test.tsx](../../tests/components/booking/ReminderToggle.test.tsx) —
 * pins the hidden-when-unsupported rule and the denied/error copy.
 */
export default function ReminderToggle({ bookingRef, email, separator }: ReminderToggleProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const { status, enable, disable } = useBookingReminder(bookingRef, email);

  if (status === "unsupported") return null;

  const on = status === "on";
  const note =
    status === "denied"
      ? t("booking.reminders.denied")
      : status === "error"
        ? t("booking.reminders.failed")
        : on
          ? t("booking.reminders.onHint")
          : t("booking.reminders.offHint");

  return (
    <>
      {separator}
      <View style={styles.wrap} testID="reminder-toggle">
        <ThemedText style={[styles.title, { color: colors.muted }]}>
          {t("booking.reminders.heading")}
        </ThemedText>
        <ButtonRow align="start">
          <Button
            testID="reminder-toggle-btn"
            variant="secondary"
            tone={on ? "success" : "brand"}
            size="sm"
            icon={on ? "notifications" : "notifications-outline"}
            loading={status === "busy"}
            disabled={status === "denied"}
            onPress={() => void (on ? disable() : enable())}
            accessibilityState={{ checked: on }}
            accessibilityLabel={
              on ? t("booking.reminders.turnOffLabel") : t("booking.reminders.turnOnLabel")
            }
          >
            {on ? t("booking.reminders.onButton") : t("booking.reminders.offButton")}
          </Button>
        </ButtonRow>
        <ThemedText style={[styles.note, { color: colors.muted }]}>{note}</ThemedText>
      </View>
    </>
  );
}
