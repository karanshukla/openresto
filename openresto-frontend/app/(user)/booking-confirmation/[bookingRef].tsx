import { ThemedText } from "@/components/themed-text";
import { getBookingByRef, getBookingById, BookingDto } from "@/api/bookings";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { PRIMARY, MUTED_LIGHT, MUTED_DARK } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import PageContainer from "@/components/layout/PageContainer";

export default function BookingConfirmationScreen() {
  const { bookingRef, email } = useLocalSearchParams<{ bookingRef: string; email: string }>();
  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const borderColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
  const mutedColor = isDark ? MUTED_DARK : MUTED_LIGHT;
  const cardBg = isDark ? "#1e2022" : "#ffffff";
  const pageBg = isDark ? "#111214" : "#f2f3f5";

  useEffect(() => {
    if (!bookingRef) return;
    async function loadBooking() {
      const numericId = /^\d+$/.test(bookingRef) ? parseInt(bookingRef, 10) : NaN;
      const data = isNaN(numericId)
        ? await getBookingByRef(bookingRef, email ?? "")
        : await getBookingById(numericId);
      setBooking(data);
      setLoading(false);
    }
    loadBooking();
  }, [bookingRef, email]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: pageBg }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.center, { backgroundColor: pageBg }]}>
        <Ionicons name="alert-circle-outline" size={40} color={mutedColor} />
        <ThemedText style={[styles.notFoundText, { color: mutedColor }]}>
          Booking not found.
        </ThemedText>
      </View>
    );
  }

  const rows: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: string }[] = [
    { icon: "mail-outline", label: "Email", value: booking.customerEmail },
    {
      icon: "calendar-outline",
      label: "Date",
      value: new Date(booking.date).toLocaleDateString(undefined, {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      }),
    },
    {
      icon: "time-outline",
      label: "Time",
      value: new Date(booking.date).toLocaleTimeString(undefined, {
        hour: "2-digit", minute: "2-digit",
      }),
    },
    { icon: "people-outline", label: "Guests", value: String(booking.seats) },
  ];

  if (booking.specialRequests) {
    rows.push({ icon: "chatbubble-outline", label: "Requests", value: booking.specialRequests });
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: pageBg }} contentContainerStyle={styles.scrollContent}>
      <PageContainer style={styles.page}>
        {/* Success header */}
        <View style={styles.successHeader}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={32} color="#fff" />
          </View>
          <ThemedText style={styles.title}>Booking Confirmed</ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
            Your reservation has been placed. Save your booking reference below.
          </ThemedText>
        </View>

        {/* Booking reference callout */}
        <View style={[styles.refCard, { backgroundColor: cardBg, borderColor }]}>
          <ThemedText style={[styles.refLabel, { color: mutedColor }]}>
            Booking Reference
          </ThemedText>
          <View style={[styles.refBadge, { backgroundColor: isDark ? "rgba(10,126,164,0.15)" : "rgba(10,126,164,0.08)" }]}>
            <ThemedText style={styles.refValue}>
              {booking.bookingRef ?? bookingRef}
            </ThemedText>
          </View>
          <ThemedText style={[styles.refHint, { color: mutedColor }]}>
            Use this reference and your email to look up your booking
          </ThemedText>
        </View>

        {/* Details card */}
        <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor }]}>
          {rows.map(({ icon, label, value }, i) => (
            <View key={label}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: borderColor }]} />}
              <View style={styles.detailRow}>
                <Ionicons name={icon} size={15} color={mutedColor} style={{ marginTop: 2 }} />
                <View style={styles.detailContent}>
                  <ThemedText style={[styles.detailLabel, { color: mutedColor }]}>{label}</ThemedText>
                  <ThemedText style={styles.detailValue}>{value}</ThemedText>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {Platform.OS === "web" && (
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: PRIMARY }]}
              onPress={() => {
                const start = new Date(booking.date);
                const end = new Date(start.getTime() + 60 * 60 * 1000);
                const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
                const ics = [
                  "BEGIN:VCALENDAR",
                  "VERSION:2.0",
                  "BEGIN:VEVENT",
                  `DTSTART:${fmt(start)}`,
                  `DTEND:${fmt(end)}`,
                  `SUMMARY:Restaurant Reservation`,
                  `DESCRIPTION:Booking ref: ${booking.bookingRef ?? bookingRef}\\nGuests: ${booking.seats}`,
                  "END:VEVENT",
                  "END:VCALENDAR",
                ].join("\r\n");
                const blob = new Blob([ics], { type: "text/calendar" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `reservation-${booking.bookingRef ?? bookingRef}.ics`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Ionicons name="calendar-outline" size={16} color="#fff" />
              <ThemedText style={styles.primaryBtnText}>Add to Calendar</ThemedText>
            </Pressable>
          )}
          <Pressable
            style={[styles.secondaryBtn, { borderColor }]}
            onPress={() => router.replace("/")}
          >
            <Ionicons name="home-outline" size={16} color={PRIMARY} />
            <ThemedText style={[styles.secondaryBtnText, { color: PRIMARY }]}>Back to Restaurants</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.secondaryBtn, { borderColor }]}
            onPress={() => router.push("/(user)/lookup")}
          >
            <Ionicons name="search-outline" size={16} color={PRIMARY} />
            <ThemedText style={[styles.secondaryBtnText, { color: PRIMARY }]}>Find My Booking</ThemedText>
          </Pressable>
        </View>
      </PageContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 60,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
    marginTop: 8,
  },
  page: {
    maxWidth: 520,
    gap: 20,
  },
  successHeader: {
    alignItems: "center",
    paddingTop: 48,
    paddingBottom: 8,
    gap: 10,
  },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  refCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  refLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  refBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  refValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0a7ea4",
    letterSpacing: -0.3,
  },
  refHint: {
    fontSize: 12,
    textAlign: "center",
  },
  detailCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  detailContent: {
    flex: 1,
    gap: 2,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "500",
  },
  divider: {
    height: 1,
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
