import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { getBookingById, BookingDto } from "@/api/bookings";
import { useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";

export default function LookupScreen() {
  const [bookingIdInput, setBookingIdInput] = useState("");
  const [booking, setBooking] = useState<BookingDto | null | undefined>(
    undefined
  );
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleLookup = async () => {
    const id = parseInt(bookingIdInput, 10);
    if (isNaN(id)) return;
    setLoading(true);
    setSearched(true);
    const result = await getBookingById(id);
    setBooking(result);
    setLoading(false);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Find My Booking</ThemedText>
      <ThemedText style={styles.subtitle}>
        Enter your booking ID to view your reservation details.
      </ThemedText>

      <ThemedText>Booking ID</ThemedText>
      <Input
        placeholder="e.g. 42"
        value={bookingIdInput}
        onChangeText={setBookingIdInput}
        keyboardType="numeric"
      />

      <Button
        onPress={handleLookup}
        disabled={!bookingIdInput || loading}
      >
        Look Up
      </Button>

      {loading && (
        <ActivityIndicator style={styles.spinner} size="large" />
      )}

      {!loading && searched && !booking && (
        <ThemedView style={styles.result}>
          <ThemedText style={styles.notFound}>
            No booking found with that ID.
          </ThemedText>
        </ThemedView>
      )}

      {!loading && booking && (
        <ThemedView style={styles.result}>
          <ThemedText type="defaultSemiBold" style={styles.resultTitle}>
            Booking #{booking.id}
          </ThemedText>
          <ThemedText>Email: {booking.customerEmail}</ThemedText>
          <ThemedText>Seats: {booking.seats}</ThemedText>
          <ThemedText>
            Date: {new Date(booking.date).toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </ThemedText>
          <ThemedText>
            Time: {new Date(booking.date).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </ThemedText>
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 8,
  },
  subtitle: {
    marginBottom: 16,
    opacity: 0.7,
  },
  spinner: {
    marginTop: 24,
  },
  result: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    gap: 8,
  },
  resultTitle: {
    fontSize: 18,
    marginBottom: 4,
  },
  notFound: {
    opacity: 0.6,
  },
});
