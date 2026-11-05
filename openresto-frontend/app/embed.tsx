import { useLocalSearchParams } from "expo-router";
import EmbedBooking from "@/components/embed/EmbedBooking";

/**
 * The page `public/embed.js` frames on a restaurant's own site. It sits outside `(user)` so it
 * carries none of the guest site's chrome; nginx sends it the only `frame-ancestors` that is
 * not `'none'`.
 */
export default function EmbedScreen() {
  const { location } = useLocalSearchParams<{ location?: string }>();
  const locationId = Number(location);
  return <EmbedBooking locationId={Number.isInteger(locationId) ? locationId : undefined} />;
}
