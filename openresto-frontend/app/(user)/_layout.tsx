import { Platform, View } from "react-native";
import { Slot, Stack } from "expo-router";
import Navbar from "@/components/layout/Navbar";

export default function UserLayout() {
  // On web: show the same top navbar, let browser handle back navigation.
  // On native: use the Stack for native back-swipe and header.
  if (Platform.OS === "web") {
    return (
      <View style={{ flex: 1 }}>
        <Navbar />
        <Slot />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="restaurant/[id]" options={{ title: "Restaurant" }} />
      <Stack.Screen
        name="book/[restaurantId]"
        options={{ title: "Book a Table" }}
      />
      <Stack.Screen
        name="booking-confirmation/[bookingId]"
        options={{ title: "Booking Confirmed", headerBackVisible: false }}
      />
      <Stack.Screen name="lookup" options={{ title: "Find My Booking" }} />
    </Stack>
  );
}
