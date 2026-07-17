import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { fetchRestaurantById, RestaurantDto } from "@/api/restaurants";
import { useEffect, useState, useRef, useCallback } from "react";
import { Image } from "expo-image";
import { Platform, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import BookingForm, { BookingFormData } from "@/components/booking/BookingForm";
import { createBooking } from "@/api/bookings";
import PageContainer from "@/components/layout/PageContainer";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { convertLocalToUtc } from "@/utils/date";
import BookingSkeleton from "@/components/booking/BookingSkeleton";
import ScrollToTopFab from "@/components/common/ScrollToTopFab";
import WalkInNotice from "@/components/booking/WalkInNotice";
import { LinkedText } from "@/components/common/LinkedText";
import Footer from "@/components/layout/Footer";

export default function BookScreen() {
  const {
    restaurantId,
    time: timeParam,
    party: partyParam,
  } = useLocalSearchParams<{
    restaurantId: string;
    time?: string;
    party?: string;
  }>();
  const initialTime = timeParam || undefined;
  const initialSeats = partyParam
    ? Math.max(1, Math.min(10, parseInt(partyParam, 10))) || undefined
    : undefined;
  const [restaurant, setRestaurant] = useState<RestaurantDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);
  const router = useRouter();
  const mutedColor = useAppTheme().colors.muted;

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
    }
  }, [restaurantId]);

  const handleSubmit = async (data: BookingFormData) => {
    if (!restaurant) return;
    setSubmitError(null);

    const dateTime = convertLocalToUtc(data.date, data.time, restaurant.timezone || "UTC");
    const bookingData = {
      customerEmail: data.customerEmail,
      customerName: data.customerName,
      seats: data.seats,
      tableId: data.tableId,
      holdId: data.holdId,
      restaurantId: restaurant.id,
      sectionId:
        data.sectionId ||
        restaurant.sections.find((s) => s.tables.some((t) => t.id === data.tableId))?.id ||
        0,
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
    return <BookingSkeleton />;
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
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={100}
      >
        <PageContainer style={styles.page}>
          {restaurant.imageUrl && !imageError && (
            <Image
              source={{ uri: restaurant.imageUrl }}
              style={styles.imageBanner}
              contentFit="cover"
              onError={() => setImageError(true)}
            />
          )}
          <ThemedText type="title" style={styles.title}>
            {restaurant.walkInOnly ? "Visit us" : "Book a table"}
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
            at {restaurant.name}
          </ThemedText>

          {restaurant.description ? (
            <LinkedText text={restaurant.description} style={styles.description} />
          ) : null}

          {restaurant.walkInOnly ? (
            <WalkInNotice scope="location" />
          ) : (
            <>
              {submitError && (
                <ThemedView style={styles.errorBanner}>
                  <ThemedText style={styles.errorText}>{submitError}</ThemedText>
                </ThemedView>
              )}

              <BookingForm
                restaurant={restaurant}
                onSubmit={handleSubmit}
                onRefresh={() => router.replace(`/(user)/book/${restaurantId}`)}
                initialTime={initialTime}
                initialSeats={initialSeats}
              />
            </>
          )}
        </PageContainer>

        <Footer />
      </ScrollView>
      <ScrollToTopFab scrollY={scrollY} onPress={scrollToTop} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
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
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: -12,
    marginBottom: 24,
  },
  imageBanner: {
    width: "100%",
    aspectRatio: 16 / 5,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  errorBanner: {
    backgroundColor: "rgba(220,38,38,0.08)",
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 8,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 14,
  },
});
