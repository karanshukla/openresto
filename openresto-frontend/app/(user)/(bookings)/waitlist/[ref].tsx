import { useLocalSearchParams } from "expo-router";
import WaitlistStatusScreen from "@/components/waitlist/WaitlistStatusScreen";

/** The "table ready" email links here, so the route is `/waitlist/<ref>` and nothing more. */
export default function WaitlistStatusRoute() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  return <WaitlistStatusScreen entryRef={ref} />;
}
