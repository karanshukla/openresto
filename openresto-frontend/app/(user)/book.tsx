import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { fetchRestaurantById, RestaurantDto } from "@/api/restaurants";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import BookingForm, { BookingFormData } from "@/components/booking/BookingForm";
import { createBooking } from "@/api/bookings";
import PageContainer from "@/components/layout/PageContainer";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getThemeColors } from "@/theme/theme";

export default function BookScreen() {
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();
  const [restaurant, setRestaurant] = useState<RestaurantDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const mutedColor = getThemeColors(isDark).muted;

  useEffect(() => {
    if (restaurantId) {
      let cancelled = false;
      async function loadRestaurant() {
        try {
          const data = await fetchRestaurantById(parseInt(restaurantId, 10));
          if (cancelled) return;
          setRestaurant(data);
        } catch (err) {
          console.error("Failed to fetch restaurant:", err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
      loadRestaurant();
      return () => {
        cancelled = true;
      };
    } else {
      setLoading(false);
    }
  }, [restaurantId]);

  const handleSubmit = async (data: BookingFormData) => {
    if (!restaurant) return;
    setSubmitError(null);

    // Parse the date/time in the context of the restaurant's timezone.
    // If restaurant.timezone is "America/New_York", and user enters 15:00, 
    // it should be exactly 15:00 in New York, regardless of user's local time.
    let dateTime: string;
    try {
      // Use Intl.DateTimeFormat to help with timezone-aware construction if needed, 
      // but simpler is to construct a string and let the server handle it or parse it here.
      // For now, construct a valid ISO-like string with the correct offset.
      // To be safest, we'll send the local string and the timezone, 
      // but our API currently expects a UTC ISO string.
      
      // Construct a Date object that reflects the target time in the target timezone.
      const localStr = `${data.date}T${data.time}:00`;
      const tz = restaurant.timezone || "UTC";
      
      // We use a trick: parse the string as local, then adjust by the difference between local and target TZ
      const tempDate = new Date(localStr);
      const targetStr = tempDate.toLocaleString("en-US", { timeZone: tz });
      const targetDate = new Date(targetStr);
      const diff = tempDate.getTime() - targetDate.getTime();
      
      dateTime = new Date(tempDate.getTime() + diff).toISOString();
    } catch (e) {
      // Fallback to original behavior if timezone parsing fails
      dateTime = new Date(`${data.date}T${data.time}:00`).toISOString();
    }
    const bookingData = {
      customerEmail: data.customerEmail,
      seats: data.seats,
      tableId: data.tableId,
      holdId: data.holdId,
      restaurantId: restaurant.id,
      sectionId:
        restaurant.sections.find((s) => s.tables.some((t) => t.id === data.tableId))?.id ?? 0,
      date: dateTime,
      specialRequests: data.specialRequests || null,
    };

    try {
      const newBooking = await createBooking(bookingData);
      const email = encodeURIComponent(data.customerEmail);
      if (newBooking?.bookingRef) {
        router.push(`/booking-confirmation/${newBooking.bookingRef}?email=${email}`);
      } else if (newBooking) {
        router.push(`/booking-confirmation/${newBooking.id}?email=${email}`);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setSubmitError(message);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (!restaurant) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Restaurant not found.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.root}>
      <ScrollView style={styles.scroll}>
        <PageContainer style={styles.page}>
          <ThemedText type="title" style={styles.title}>
            Book a table
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
            at {restaurant.name}
          </ThemedText>

          {submitError && (
            <ThemedView style={styles.errorBanner}>
              <ThemedText style={styles.errorText}>{submitError}</ThemedText>
            </ThemedView>
          )}

          <BookingForm
            restaurant={restaurant}
            onSubmit={handleSubmit}
            onRefresh={() => router.replace(`/book?restaurantId=${restaurantId}`)}
          />
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  page: {
    maxWidth: Platform.OS === "web" ? 860 : 560,
    gap: 4,
  },
  title: {
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  errorBanner: {
    backgroundColor: "rgba(229,62,62,0.1)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
  },
});
