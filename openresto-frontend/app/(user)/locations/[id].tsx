import { Stack, useLocalSearchParams } from "expo-router";
import { useBrand } from "@/context/BrandContext";
import LocationsScreen from "@/components/restaurant/LocationsScreen";

/**
 * Deep-link entry into the Locations list: renders the same screen as
 * `locations/index` but expands + scrolls to a specific location on mount,
 * with optional `time`/`party` prefilled into its booking form. This is the
 * target of `RestaurantCard` slot clicks and the old `/book/[restaurantId]`
 * and `/restaurant/[id]` redirects.
 */
export default function LocationsDetailScreen() {
  const brand = useBrand();
  const { id, time, party } = useLocalSearchParams<{
    id: string;
    time?: string;
    party?: string;
  }>();
  const highlightId = id ? Number(id) : undefined;
  const initialSeats = party
    ? Math.max(1, Math.min(10, parseInt(party, 10))) || undefined
    : undefined;

  return (
    <>
      <Stack.Screen options={{ title: brand.appName }} />
      <LocationsScreen
        highlightId={Number.isFinite(highlightId) ? highlightId : undefined}
        initialTime={time || undefined}
        initialSeats={initialSeats}
      />
    </>
  );
}
