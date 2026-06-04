import { Redirect, useLocalSearchParams } from "expo-router";

export default function BookRedirect() {
  const { restaurantId } = useLocalSearchParams<{ restaurantId?: string }>();
  if (restaurantId) {
    return <Redirect href={`/(user)/book/${restaurantId}`} />;
  }
  return <Redirect href="/" />;
}
