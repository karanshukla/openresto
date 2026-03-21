import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { getBookingById, BookingDto } from "@/api/bookings";
import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import PageContainer from "@/components/layout/PageContainer";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function MyBookingScreen() {
  const [bookingIdInput, setBookingIdInput] = useState("");
  const [booking, setBooking] = useState<BookingDto | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const isDark = useColorScheme() === "dark";
  const borderColor = isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.08)";
  const mutedColor = isDark ? "#9ca3af" : "#6b7280";

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
    <ScrollView style={styles.scroll}>
      <PageContainer style={styles.page}>
        <View style={styles.header}>
          <ThemedText type="title">My Booking</ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
            Enter your booking ID to view your reservation details.
          </ThemedText>
        </View>

        <ThemedView style={[styles.searchCard, { borderColor }]}>
          <ThemedText type="defaultSemiBold" style={styles.searchLabel}>
            Booking ID
          </ThemedText>
          <Input
            placeholder="e.g. 42"
            value={bookingIdInput}
            onChangeText={setBookingIdInput}
            keyboardType="numeric"
          />
          <Button onPress={handleLookup} disabled={!bookingIdInput || loading}>
            {loading ? "Looking up…" : "Find Booking"}
          </Button>
        </ThemedView>

        {loading && <ActivityIndicator style={styles.spinner} size="large" />}

        {!loading && searched && !booking && (
          <ThemedView style={[styles.resultCard, { borderColor }]}>
            <ThemedText style={[styles.notFound, { color: mutedColor }]}>
              No booking found with ID #{bookingIdInput}. Please check and try again.
            </ThemedText>
          </ThemedView>
        )}

        {!loading && booking && (
          <ThemedView style={[styles.resultCard, { borderColor }]}>
            <View style={styles.resultHeader}>
              <ThemedText type="defaultSemiBold" style={styles.bookingId}>
                Booking #{booking.id}
              </ThemedText>
            </View>

            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            {[
              {
                label: "Email",
                value: booking.customerEmail,
              },
              {
                label: "Date",
                value: new Date(booking.date).toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }),
              },
              {
                label: "Time",
                value: new Date(booking.date).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              },
              {
                label: "Seats",
                value: String(booking.seats),
              },
            ].map(({ label, value }) => (
              <View key={label} style={styles.row}>
                <ThemedText style={[styles.rowLabel, { color: mutedColor }]}>
                  {label}
                </ThemedText>
                <ThemedText style={styles.rowValue}>{value}</ThemedText>
              </View>
            ))}
          </ThemedView>
        )}
      </PageContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  page: {
    maxWidth: 560,
    gap: 20,
  },
  header: {
    paddingTop: 16,
    gap: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  searchCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    gap: 4,
  },
  searchLabel: {
    marginBottom: 4,
  },
  spinner: {
    marginTop: 24,
  },
  resultCard: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  resultHeader: {
    padding: 16,
  },
  bookingId: {
    fontSize: 18,
  },
  divider: {
    height: 1,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowLabel: {
    fontSize: 14,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "right",
    flex: 1,
    marginLeft: 16,
  },
  notFound: {
    padding: 20,
    fontSize: 15,
    textAlign: "center",
  },
});
