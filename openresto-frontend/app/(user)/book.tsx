import { Redirect, useLocalSearchParams, type Href } from "expo-router";

/**
 * `?restaurantId=` redirector — retargeted from the old `/book/[restaurantId]`
 * route to the new merged Locations page.
 */
export default function BookQueryRedirect() {
  const { restaurantId } = useLocalSearchParams<{ restaurantId?: string }>();
  if (restaurantId) {
    return <Redirect href={`/(user)/locations/${restaurantId}` as Href} />;
  }
  return <Redirect href="/" />;
}
