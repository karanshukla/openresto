import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import Button from "@/components/common/Button";
import { getBookingById, deleteBooking, BookingDto } from "@/api/bookings";
import { fetchRestaurantById, RestaurantDto } from "@/api/restaurants";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function AdminBookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!id) return;
    async function load() {
      const b = await getBookingById(parseInt(id, 10));
      setBooking(b);
      if (b) {
        const r = await fetchRestaurantById(b.restaurantId);
        setRestaurant(r);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const handleDelete = () => {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking? This cannot be undone.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel Booking",
          style: "destructive",
          onPress: async () => {
            if (!booking) return;
            setDeleting(true);
            const success = await deleteBooking(booking.id);
            if (success) {
              router.back();
            } else {
              setDeleting(false);
              Alert.alert("Error", "Failed to cancel the booking.");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (!booking) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Booking not found.</ThemedText>
      </ThemedView>
    );
  }

  const section = restaurant?.sections.find((s) => s.id === booking.sectionId);
  const table = section?.tables.find((t) => t.id === booking.tableId);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Booking #{booking.id}
      </ThemedText>

      <ThemedView style={styles.card}>
        <ThemedView style={styles.row}>
          <ThemedText style={styles.label}>Customer</ThemedText>
          <ThemedText>{booking.customerEmail}</ThemedText>
        </ThemedView>
        <ThemedView style={styles.divider} />
        <ThemedView style={styles.row}>
          <ThemedText style={styles.label}>Date</ThemedText>
          <ThemedText>
            {new Date(booking.date).toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.divider} />
        <ThemedView style={styles.row}>
          <ThemedText style={styles.label}>Time</ThemedText>
          <ThemedText>
            {new Date(booking.date).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.divider} />
        <ThemedView style={styles.row}>
          <ThemedText style={styles.label}>Seats</ThemedText>
          <ThemedText>{booking.seats}</ThemedText>
        </ThemedView>
        {section && (
          <>
            <ThemedView style={styles.divider} />
            <ThemedView style={styles.row}>
              <ThemedText style={styles.label}>Section</ThemedText>
              <ThemedText>{section.name}</ThemedText>
            </ThemedView>
          </>
        )}
        {table && (
          <>
            <ThemedView style={styles.divider} />
            <ThemedView style={styles.row}>
              <ThemedText style={styles.label}>Table</ThemedText>
              <ThemedText>
                {table.name ?? `Table ${table.id}`} (capacity {table.seats})
              </ThemedText>
            </ThemedView>
          </>
        )}
        {restaurant && (
          <>
            <ThemedView style={styles.divider} />
            <ThemedView style={styles.row}>
              <ThemedText style={styles.label}>Restaurant</ThemedText>
              <ThemedText>{restaurant.name}</ThemedText>
            </ThemedView>
          </>
        )}
      </ThemedView>

      <Button onPress={handleDelete} disabled={deleting}>
        {deleting ? "Cancelling..." : "Cancel Booking"}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    padding: 16,
    gap: 16,
  },
  title: {
    marginBottom: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(128,128,128,0.3)",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    backgroundColor: "transparent",
  },
  label: {
    opacity: 0.6,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(128,128,128,0.15)",
  },
});
