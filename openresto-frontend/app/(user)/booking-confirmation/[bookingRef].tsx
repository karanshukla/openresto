import { ThemedText } from "@/components/themed-text";
import { getBookingByRef, getBookingById, BookingDto } from "@/api/bookings";
import { fetchRestaurantById, RestaurantDto } from "@/api/restaurants";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { COLORS, BUTTON_SIZES, getThemeColors } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import PageContainer from "@/components/layout/PageContainer";
import { useBrand } from "@/context/BrandContext";
import { Stack } from "expo-router";
import CalendarActions from "@/components/booking/CalendarActions";
import BookingDetailRows from "@/components/booking/BookingDetailRows";

export default function BookingConfirmationScreen() {
  const { bookingRef, email } = useLocalSearchParams<{ bookingRef: string; email: string }>();
  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const brand = useBrand();
  const accent = brand.primaryColor || COLORS.primary;
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 768;

  useEffect(() => {
    if (!bookingRef) return;
    let cancelled = false;
    async function load() {
      const numericId = /^\d+$/.test(bookingRef) ? parseInt(bookingRef, 10) : NaN;
      const data = isNaN(numericId)
        ? await getBookingByRef(bookingRef, email ?? "")
        : await getBookingById(numericId);
      if (cancelled) return;
      setBooking(data);
      if (data?.restaurantId) {
        const r = await fetchRestaurantById(data.restaurantId);
        if (cancelled) return;
        setRestaurant(r);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [bookingRef, email]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.page }]}>
        <Stack.Screen options={{ title: "Booking Confirmation" }} />
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.center, { backgroundColor: colors.page }]}>
        <Stack.Screen options={{ title: "Not Found" }} />
        <Ionicons name="alert-circle-outline" size={40} color={colors.muted} />
        <ThemedText style={[styles.notFoundText, { color: colors.muted }]}>Booking not found.</ThemedText>
        <Pressable style={[styles.retryBtn, { borderColor: colors.border }]} onPress={() => router.replace("/")}>
          <ThemedText style={[styles.retryBtnText, { color: accent }]}>Back to Home</ThemedText>
        </Pressable>
      </View>
    );
  }

  const ref = booking.bookingRef ?? bookingRef;
  const restaurantName = restaurant?.name ?? "Restaurant";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.page }} contentContainerStyle={styles.scrollContent}>
      <Stack.Screen options={{ title: "Booking Confirmed" }} />
      <PageContainer>
        <View style={styles.successHeader}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={32} color="#fff" />
          </View>
          <ThemedText style={styles.title}>Booking Confirmed</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.muted }]}>
            {booking.seats} {booking.seats === 1 ? "guest" : "guests"} at {restaurantName}. Save your reference below.
          </ThemedText>
        </View>

        <RefCard ref={ref} accent={accent} isDark={isDark} colors={colors} copied={copied} onCopy={() => { navigator.clipboard.writeText(ref); setCopied(true); setTimeout(() => setCopied(false), 2000); }} />

        <View style={isWide ? styles.wideRow : styles.narrowGap}>
          <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }, isWide && styles.wideCol]}>
            <BookingDetailRows booking={booking} restaurant={restaurant} mutedColor={colors.muted} borderColor={colors.border} />
          </View>

          {Platform.OS === "web" && ref && (
            <View style={isWide && styles.wideCol}>
              <View style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <CalendarActions
                  bookingRef={ref}
                  date={booking.date}
                  seats={booking.seats}
                  specialRequests={booking.specialRequests}
                  restaurantName={restaurantName}
                  restaurantAddress={restaurant?.address ?? ""}
                  variant="full"
                />
              </View>
            </View>
          )}
        </View>

        <View style={isWide ? styles.actionsWide : styles.actions}>
          <Pressable style={[styles.secondaryBtn, { borderColor: colors.border }]} onPress={() => router.replace("/")}>
            <Ionicons name="home-outline" size={16} color={accent} />
            <ThemedText style={[styles.secondaryBtnText, { color: accent }]}>Back to Restaurants</ThemedText>
          </Pressable>
          <Pressable style={[styles.secondaryBtn, { borderColor: colors.border }]} onPress={() => router.push("/(user)/lookup")}>
            <Ionicons name="search-outline" size={16} color={accent} />
            <ThemedText style={[styles.secondaryBtnText, { color: accent }]}>Find My Booking</ThemedText>
          </Pressable>
        </View>
      </PageContainer>
    </ScrollView>
  );
}

function RefCard({ ref, accent, isDark, colors, copied, onCopy }: {
  ref: string; accent: string; isDark: boolean; colors: ReturnType<typeof getThemeColors>; copied: boolean; onCopy: () => void;
}) {
  return (
    <View style={[styles.refCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <ThemedText style={[styles.refLabel, { color: colors.muted }]}>Booking Reference</ThemedText>
      <View style={styles.refRow}>
        <View style={[styles.refBadge, { backgroundColor: isDark ? `${accent}22` : `${accent}14` }]}>
          <ThemedText style={[styles.refValue, { color: accent }]}>{ref}</ThemedText>
        </View>
        {Platform.OS === "web" && (
          <Pressable style={[styles.copyBtn, { borderColor: colors.border }]} onPress={onCopy}>
            <Ionicons name={copied ? "checkmark" : "copy-outline"} size={14} color={copied ? "#16a34a" : accent} />
            <ThemedText style={[styles.copyBtnText, { color: copied ? "#16a34a" : accent }]}>
              {copied ? "Copied" : "Copy"}
            </ThemedText>
          </Pressable>
        )}
      </View>
      <ThemedText style={[styles.refHint, { color: colors.muted }]}>
        Use this reference and your email to look up your booking
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, paddingBottom: 60 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 },
  notFoundText: { fontSize: 16, marginTop: 8 },
  retryBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  retryBtnText: { fontSize: 14, fontWeight: "600" },
  successHeader: { alignItems: "center", paddingTop: 48, paddingBottom: 16, gap: 10 },
  checkCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#16a34a", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, textAlign: "center" },
  subtitle: { fontSize: 15, textAlign: "center", lineHeight: 22, maxWidth: 400 },
  refCard: { borderRadius: 14, borderWidth: 1, padding: 24, alignItems: "center", gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  refLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  refRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" },
  refBadge: { ...BUTTON_SIZES.secondary, borderRadius: 10 },
  refValue: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  copyBtnText: { fontSize: 12, fontWeight: "600" },
  refHint: { fontSize: 12, textAlign: "center" },
  wideRow: { flexDirection: "row", gap: 20, alignItems: "flex-start", marginTop: 4 },
  narrowGap: { gap: 16, marginTop: 4 },
  wideCol: { flex: 1 },
  detailCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  actionCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  actions: { gap: 10, marginTop: 8 },
  actionsWide: { flexDirection: "row", gap: 12, marginTop: 8 },
  secondaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 10, borderWidth: 1, flex: 1 },
  secondaryBtnText: { fontSize: 15, fontWeight: "600" },
});
