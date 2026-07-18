import { Redirect, useLocalSearchParams, type Href } from "expo-router";

/**
 * Redirect shim: the standalone booking page has been folded into the Locations
 * list (`/locations/[id]`), preserving the `time`/`party` query params so slot
 * prefill keeps working. Kept as a thin redirect for existing deep links.
 */
export default function BookRedirect() {
  const { restaurantId, time, party } = useLocalSearchParams<{
    restaurantId: string;
    time?: string;
    party?: string;
  }>();
  if (!restaurantId) return <Redirect href="/" />;
  // Build the query string manually rather than via URLSearchParams, which
  // isn't available in every runtime this redirect renders under (e.g. the
  // jsdom test environment). Order: time, then party.
  const params: string[] = [];
  if (time) params.push(`time=${encodeURIComponent(time)}`);
  if (party) params.push(`party=${encodeURIComponent(party)}`);
  const suffix = params.length > 0 ? `?${params.join("&")}` : "";
  return <Redirect href={`/(user)/locations/${restaurantId}${suffix}` as Href} />;
}
