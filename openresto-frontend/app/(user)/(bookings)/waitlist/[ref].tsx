import { useLocalSearchParams } from "expo-router";
import LookupScreen from "@/components/booking/LookupScreen";

/**
 * The "table ready" email links here, so the route is `/waitlist/<ref>` and nothing more. Like
 * the booking confirmation, it is My bookings with the ticket open rather than a page of its own.
 */
export default function WaitlistStatusRoute() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  return <LookupScreen initialTicketRef={ref} />;
}
