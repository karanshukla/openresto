import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Button from "@/components/common/Button";
import { useAppTheme } from "@/hooks/use-app-theme";
import { theme } from "@/theme/theme";
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
 * It is the last thing above the screen's own bottom edge, so it owns the gesture inset: the
 * sheet is presented through `@gorhom/portal`, whose host sits above the tab navigator, so
 * `useSafeAreaInsets` here answers for the window and not for a tab's content area. Without it
 * the confirm ran to the physical bottom of the screen and Android drew the home handle across
 * it. `theme.spacing.md` is the floor, so a device that reports no inset still separates the
 * button from the sheet's edge rather than resting the two together.
 *
 * @see [DockedBookingSubmit.test.tsx](../../tests/components/booking/DockedBookingSubmit.test.tsx)
 * — pins that it stays empty until the form publishes, and that it presses through to it.
 */
export function DockedBookingSubmit() {
  const dock = useBookingDock();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  if (!dock) return null;

  return (
    <View
      testID="booking-docked-submit"
      style={[
        styles.dock,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, theme.spacing.md),
        },
      ]}
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
