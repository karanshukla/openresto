import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { fetchRestaurantById, RestaurantDto } from "@/api/restaurants";
import { useEffect, useState, useRef, useCallback } from "react";
import { ScrollView, StyleSheet } from "react-native";
import RestaurantDetails from "@/components/restaurant/RestaurantDetails";
import { Link, useLocalSearchParams } from "expo-router";
import PageContainer from "@/components/layout/PageContainer";
import Button from "@/components/common/Button";
import RestaurantSkeleton from "@/components/restaurant/RestaurantSkeleton";
import ScrollToTopFab from "@/components/common/ScrollToTopFab";

export default function RestaurantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [restaurant, setRestaurant] = useState<RestaurantDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrollY, setScrollY] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  useEffect(() => {
    if (id) {
      let cancelled = false;
      async function loadRestaurant() {
        try {
          const data = await fetchRestaurantById(parseInt(id, 10));
          if (!cancelled) {
            setRestaurant(data);
          }
        } catch (error) {
          console.error("Failed to load restaurant:", error);
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
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
  }, [id]);

  if (loading) {
    return <RestaurantSkeleton />;
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
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={100}
      >
        <PageContainer style={styles.page}>
          <RestaurantDetails restaurant={restaurant} />
          <Link href={`/(user)/book/${id}`} asChild>
            <Button style={styles.bookButton}>Book a Table</Button>
          </Link>
        </PageContainer>
      </ScrollView>
      <ScrollToTopFab scrollY={scrollY} onPress={scrollToTop} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  page: {
    maxWidth: 720,
    gap: 16,
  },
  bookButton: {
    marginTop: 8,
  },
});
