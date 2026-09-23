import { useLocalSearchParams } from "expo-router";
import JoinWaitlistScreen from "@/components/waitlist/JoinWaitlistScreen";

export default function JoinWaitlistRoute() {
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();
  return <JoinWaitlistScreen restaurantId={Number(restaurantId)} />;
}
