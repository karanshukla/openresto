import { Redirect, useLocalSearchParams, type Href } from "expo-router";

/**
 * Redirect shim: the standalone restaurant detail page has been folded into the
 * Locations list (`/locations/[id]`). Kept as a thin redirect so existing
 * links — QR codes, bookmarks — keep working.
 */
export default function RestaurantRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={(id ? `/(user)/locations/${id}` : "/") as Href} />;
}
