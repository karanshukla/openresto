import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  fetchRestaurantById,
  RestaurantDto,
} from "@/api/restaurants";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import BookingForm, {
  BookingFormData,
} from "@/components/booking/BookingForm";
import { createBooking } from "@/api/bookings";

export default function BookScreen() {
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();
  const [restaurant, setRestaurant] = useState<RestaurantDto | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (restaurantId) {
      async function loadRestaurant() {
        const data = await fetchRestaurantById(parseInt(restaurantId, 10));
        setRestaurant(data);
        setLoading(false);
      }
      loadRestaurant();
    }
  }, [restaurantId]);

  const handleSubmit = async (data: BookingFormData) => {
    if (restaurant) {
      const bookingData = {
        ...data,
        restaurantId: restaurant.id,
        sectionId:
          restaurant.sections
            .find((s) => s.tables.some((t) => t.id === data.tableId))?.id ?? 0,
        date: new Date().toISOString(),
      };
      const newBooking = await createBooking(bookingData);
      if (newBooking) {
        router.push(`/booking-confirmation/${newBooking.id}`);
      }
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (!restaurant) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Restaurant not found.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Book a table at {restaurant.name}</ThemedText>
      <BookingForm restaurant={restaurant} onSubmit={handleSubmit} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
});
