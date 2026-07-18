import { Stack } from "expo-router";
import LocationsScreen from "@/components/restaurant/LocationsScreen";

export default function LocationsIndexScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Locations" }} />
      <LocationsScreen />
    </>
  );
}
