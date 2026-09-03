import { View } from "react-native";
import { useTranslation } from "react-i18next";
import Button from "@/components/common/Button";
import { useAppTheme } from "@/hooks/use-app-theme";
import HoldStatusBanner from "./HoldStatusBanner";
import { useBookingDock } from "./BookingDockContext";
import { styles } from "./DockedBookingSubmit.styles";

/**
 * The booking form's confirm, docked to the bottom of the sheet.
 *
 * The sheet opens at a detent that puts the end of the form below the fold, so the one action
 * the guest came for was never on screen — they had to scroll past the seating picker and the
 * GDPR paragraph to find it. It appears once there is something to confirm (the form publishes
 * itself only after a name and a valid email), which is also the moment the table is held, so
 * the countdown and the button arrive together.
 *
 * Renders nothing when the form has published nothing, so the sheet keeps its full height while
 * the guest is still choosing a time — the part that needs the room.
 *
 * @see [DockedBookingSubmit.test.tsx](../../tests/components/booking/DockedBookingSubmit.test.tsx)
 * — pins that it stays empty until the form publishes, and that it presses through to it.
 */
export function DockedBookingSubmit() {
  const dock = useBookingDock();
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  if (!dock) return null;

  return (
    <View
      testID="booking-docked-submit"
      style={[styles.dock, { backgroundColor: colors.card, borderTopColor: colors.border }]}
    >
      <HoldStatusBanner
        holdStatus={dock.holdStatus}
        secondsLeft={dock.secondsLeft}
        hasSelection={dock.hasSelection}
        holdMessage={dock.holdMessage}
        onRefresh={dock.onRefresh}
      />
      <Button
        onPress={dock.onSubmit}
        disabled={dock.disabled}
        loading={dock.submitting}
        fullWidth
        accessibilityLabel={t("booking.form.confirmBookingLabel")}
      >
        {dock.submitting ? t("booking.form.confirmingLabel") : t("booking.form.confirmLabel")}
      </Button>
    </View>
  );
}

export default DockedBookingSubmit;
