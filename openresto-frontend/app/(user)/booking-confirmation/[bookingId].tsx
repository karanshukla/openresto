import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { getBookingById, BookingDto } from "@/api/bookings";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import Button from "@/components/common/Button";

export default function BookingConfirmationScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (bookingId) {
      async function loadBooking() {
        const data = await getBookingById(parseInt(bookingId, 10));
        setBooking(data);
        setLoading(false);
      }
      loadBooking();
    }
  }, [bookingId]);

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (!booking) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Booking not found.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Booking Confirmed!</ThemedText>
      <ThemedText>Your booking ID is {booking.id}.</ThemedText>
      <ThemedText>Email: {booking.customerEmail}</ThemedText>
      <ThemedText>Seats: {booking.seats}</ThemedText>
      <ThemedText>Date: {new Date(booking.date).toLocaleString()}</ThemedText>
      <Link href="/" asChild>
        <Button>Go to Home</Button>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
});
