import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import GuestTabStack, { tabRoot } from "@/components/layout/GuestTabStack";

/**
 * The list is this tab's root under a cold link straight to a location or to one of the legacy
 * booking URLs, so the header's back arrow has somewhere to go. It is also what keeps the stack
 * from opening on a redirect shim: by route order `book` sorts ahead of `locations/index`, and
 * a tab that mounts on `/book` sends itself to `/` before the diner has touched it.
 *
 * @see [tab-layouts.test.tsx](<../../../tests/app/(user)/tab-layouts.test.tsx>) — pins the
 * root, and that every shim resolving to a location lives in this group.
 */
export const unstable_settings = { initialRouteName: "locations/index" };

/**
 * The Locations tab: the list, the location a link lands on, and the redirect shims that resolve
 * to one — `/book`, `/book/[restaurantId]` and `/restaurant/[id]` all end at `/locations/[id]`,
 * which is why they live here rather than under Home.
 */
export default function LocationsTabLayout() {
  const { t } = useTranslation();

  return (
    <GuestTabStack>
      <Stack.Screen
        name="locations/index"
        options={{ ...tabRoot(), title: t("restaurant.locationsScreen.routeTitle") }}
      />
      <Stack.Screen
        name="locations/[id]"
        options={{ title: t("restaurant.locationsScreen.routeTitle") }}
      />
      <Stack.Screen
        name="restaurant/[id]"
        options={{ title: t("restaurant.details.routeTitle") }}
      />
      <Stack.Screen name="book" options={{ title: t("booking.form.routeTitle") }} />
      <Stack.Screen name="book/[restaurantId]" options={{ title: t("booking.form.routeTitle") }} />
    </GuestTabStack>
  );
}
