import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { getBookingByRef, getBookingById, BookingDto } from "@/api/bookings";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import Button from "@/components/common/Button";
import PageContainer from "@/components/layout/PageContainer";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function BookingConfirmationScreen() {
  const { bookingRef } = useLocalSearchParams<{ bookingRef: string }>();
  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [loading, setLoading] = useState(true);
  const isDark = useColorScheme() === "dark";
  const borderColor = isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.08)";
  const mutedColor = isDark ? "#9ca3af" : "#6b7280";

  useEffect(() => {
    if (!bookingRef) return;
    async function loadBooking() {
      // Support legacy numeric IDs in the URL (transitional period)
      const numericId = /^\d+$/.test(bookingRef) ? parseInt(bookingRef, 10) : NaN;
      const data = isNaN(numericId)
        ? await getBookingByRef(bookingRef)
        : await getBookingById(numericId);
      setBooking(data);
      setLoading(false);
    }
    loadBooking();
  }, [bookingRef]);

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

  return (
    <ScrollView style={styles.scroll}>
      <PageContainer style={styles.page}>
        {/* Success header */}
        <View style={styles.successHeader}>
          <ThemedText style={styles.checkCircle}>✓</ThemedText>
          <ThemedText type="title" style={styles.title}>
            Booking Confirmed
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
            Your reservation has been placed. Save your booking reference below.
          </ThemedText>
        </View>

        {/* Booking reference callout */}
        <ThemedView style={[styles.idCallout, { borderColor }]}>
          <ThemedText style={[styles.idLabel, { color: mutedColor }]}>
            Booking Reference
          </ThemedText>
          <ThemedText style={styles.idValue}>{booking.bookingRef ?? bookingRef}</ThemedText>
          <ThemedText style={[styles.idHint, { color: mutedColor }]}>
            Use this reference to look up your booking under "My Booking"
          </ThemedText>
        </ThemedView>

        {/* Details card */}
        <ThemedView style={[styles.card, { borderColor }]}>
          <View style={styles.row}>
            <ThemedText style={[styles.label, { color: mutedColor }]}>Email</ThemedText>
            <ThemedText style={styles.value}>{booking.customerEmail}</ThemedText>
          </View>
          <View style={[styles.divider, { backgroundColor: borderColor }]} />
          <View style={styles.row}>
            <ThemedText style={[styles.label, { color: mutedColor }]}>Date</ThemedText>
            <ThemedText style={styles.value}>
              {new Date(booking.date).toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </ThemedText>
          </View>
          <View style={[styles.divider, { backgroundColor: borderColor }]} />
          <View style={styles.row}>
            <ThemedText style={[styles.label, { color: mutedColor }]}>Time</ThemedText>
            <ThemedText style={styles.value}>
              {new Date(booking.date).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </ThemedText>
          </View>
          <View style={[styles.divider, { backgroundColor: borderColor }]} />
          <View style={styles.row}>
            <ThemedText style={[styles.label, { color: mutedColor }]}>Seats</ThemedText>
            <ThemedText style={styles.value}>{booking.seats}</ThemedText>
          </View>
          {!!booking.specialRequests && (
            <>
              <View style={[styles.divider, { backgroundColor: borderColor }]} />
              <View style={styles.row}>
                <ThemedText style={[styles.label, { color: mutedColor }]}>Special Requests</ThemedText>
                <ThemedText style={styles.value}>{booking.specialRequests}</ThemedText>
              </View>
            </>
          )}
        </ThemedView>

        <Link href="/" asChild>
          <Button>Back to Restaurants</Button>
        </Link>
      </PageContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  page: {
    maxWidth: 560,
    gap: 20,
  },
  successHeader: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 8,
    gap: 8,
  },
  checkCircle: {
    fontSize: 40,
    color: "#16a34a",
    marginBottom: 4,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  idCallout: {
    borderWidth: 2,
    borderRadius: 12,
    borderStyle: "dashed",
    padding: 20,
    alignItems: "center",
    gap: 4,
  },
  idLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  idValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0a7ea4",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  idHint: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "right",
    flex: 1,
    marginLeft: 16,
  },
  divider: {
    height: 1,
  },
});
