import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import GuestTabStack, { tabRoot } from "@/components/layout/GuestTabStack";

/**
 * A confirmation link opened cold sits over the lookup root the same way an in-app booking's
 * does, so the system back lands in the same place either way.
 */
export const unstable_settings = { initialRouteName: "lookup" };

/**
 * The My booking tab: the lookup form, and the confirmation and waitlist links, which are that
 * screen with a booking open or a ticket added rather than screens of their own. Keeping them in
 * this group is what keeps the tab selected on them.
 */
export default function BookingsTabLayout() {
  const { t } = useTranslation();

  return (
    <GuestTabStack>
      <Stack.Screen name="lookup" options={{ ...tabRoot(), title: t("lookup.routeTitle") }} />
      <Stack.Screen
        name="booking-confirmation/[bookingRef]"
        options={{ ...tabRoot(), title: t("booking.result.routeTitleConfirmed") }}
      />
      <Stack.Screen
        name="waitlist/[ref]"
        options={{ ...tabRoot(), title: t("booking.waitlistStatus.routeTitle") }}
      />
    </GuestTabStack>
  );
}
