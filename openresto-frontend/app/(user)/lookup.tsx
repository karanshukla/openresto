import { ThemedText } from "@/components/themed-text";
import { getBookingByRef, BookingDto } from "@/api/bookings";
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
import Input from "@/components/common/Input";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { MUTED_LIGHT, MUTED_DARK } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import PageContainer from "@/components/layout/PageContainer";
import { CachedBooking, fetchCachedBookings } from "@/utils/bookingCache";
import { useBrand } from "@/context/BrandContext";

export default function LookupScreen() {
  const [refInput, setRefInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [booking, setBooking] = useState<BookingDto | null | undefined>(undefined);
  const [restaurant, setRestaurant] = useState<RestaurantDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [cached, setCached] = useState<CachedBooking[]>([]);
  const isDark = useColorScheme() === "dark";
  const brand = useBrand();
  const accent = brand.primaryColor || "#0a7ea4";
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 768;

  useEffect(() => {
    fetchCachedBookings().then(setCached);
  }, []);

  const mutedColor = isDark ? MUTED_DARK : MUTED_LIGHT;
  const cardBg = isDark ? "#1e2022" : "#ffffff";
  const borderColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
  const pageBg = isDark ? "#111214" : "#f2f3f5";

  const canSearch = refInput.trim() && emailInput.trim();

  const handleLookup = async () => {
    const ref = refInput.trim();
    const email = emailInput.trim();
    if (!ref || !email) return;
    setLoading(true);
    setSearched(true);
    setRestaurant(null);
    const result = await getBookingByRef(ref, email);
    setBooking(result);
    if (result?.restaurantId) {
      const r = await fetchRestaurantById(result.restaurantId);
      setRestaurant(r);
    }
    setLoading(false);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: pageBg }}
      contentContainerStyle={styles.scrollContent}
    >
      <PageContainer>
        <View style={styles.header}>
          <Ionicons name="search-outline" size={32} color={accent} />
          <ThemedText style={styles.title}>Find My Booking</ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
            Enter your booking reference and email to look up your reservation.
          </ThemedText>
        </View>

        <View style={isWide ? styles.wideRow : undefined}>
          {/* Left column: search form */}
          <View style={isWide ? styles.wideCol : undefined}>
            <View style={[styles.searchCard, { backgroundColor: cardBg, borderColor }]}>
              <ThemedText style={styles.label}>Booking Reference</ThemedText>
              <Input
                placeholder="e.g. crispy-basil-thyme"
                value={refInput}
                onChangeText={setRefInput}
                autoCapitalize="none"
              />
              <ThemedText style={styles.label}>Email Address</ThemedText>
              <Input
                placeholder="The email used when booking"
                value={emailInput}
                onChangeText={setEmailInput}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="go"
                onSubmitEditing={handleLookup}
              />
              <Pressable
                onPress={handleLookup}
                disabled={!canSearch || loading}
                style={[
                  styles.searchBtn,
                  { backgroundColor: accent },
                  (!canSearch || loading) && { opacity: 0.5 },
                ]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="search" size={16} color="#fff" />
                    <ThemedText style={styles.searchBtnText}>Look Up</ThemedText>
                  </>
                )}
              </Pressable>
              <ThemedText style={[styles.helpText, { color: mutedColor }]}>
                Can't find your booking? Contact the restaurant directly for assistance.
              </ThemedText>
            </View>

            {/* Recent bookings — under search on wide, at bottom on narrow */}
            {isWide && cached.length > 0 && (
              <View style={styles.recentSection}>
                <ThemedText style={[styles.recentTitle, { color: mutedColor }]}>
                  YOUR RECENT BOOKINGS
                </ThemedText>
                {cached.map((c) => (
                  <Pressable
                    key={c.bookingRef}
                    style={[styles.recentCard, { backgroundColor: cardBg, borderColor }]}
                    onPress={async () => {
                      setRefInput(c.bookingRef);
                      setEmailInput(c.email);
                      setLoading(true);
                      setSearched(true);
                      setRestaurant(null);
                      const result = await getBookingByRef(c.bookingRef, c.email);
                      setBooking(result);
                      if (result?.restaurantId) {
                        const r = await fetchRestaurantById(result.restaurantId);
                        setRestaurant(r);
                      }
                      setLoading(false);
                    }}
                  >
                    <View style={styles.recentCardRow}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <ThemedText style={styles.recentRef}>{c.bookingRef}</ThemedText>
                        <ThemedText style={[styles.recentMeta, { color: mutedColor }]}>
                          {c.restaurantName ? `${c.restaurantName} · ` : ""}
                          {new Date(c.date).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                          {" · "}
                          {c.seats} guest{c.seats !== 1 ? "s" : ""}
                        </ThemedText>
                      </View>
                      <Ionicons name="chevron-forward-outline" size={16} color={mutedColor} />
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Right column: result */}
          <View style={isWide ? styles.wideCol : undefined}>
            {!loading && searched && !booking && (
              <View
                style={[
                  styles.resultCard,
                  { backgroundColor: cardBg, borderColor },
                  isWide && { marginTop: 0 },
                ]}
              >
                <Ionicons name="alert-circle-outline" size={28} color={mutedColor} />
                <ThemedText style={[styles.notFound, { color: mutedColor }]}>
                  No booking found matching that reference and email. It may have been cancelled or
                  deleted. Please contact the restaurant directly if you have any other questions.
                </ThemedText>
              </View>
            )}

            {!loading && booking && (
              <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor }]}>
                {/* Header inside card */}
                <View style={styles.cardHeader}>
                  <View style={styles.resultHeader}>
                    <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                    <ThemedText style={styles.resultTitle}>Booking Found</ThemedText>
                  </View>
                  <View
                    style={[
                      styles.refBadge,
                      { backgroundColor: isDark ? `${accent}22` : `${accent}14` },
                    ]}
                  >
                    <ThemedText style={[styles.refText, { color: accent }]}>
                      {booking.bookingRef}
                    </ThemedText>
                  </View>
                </View>
                <View style={[styles.detailDivider, { backgroundColor: borderColor }]} />
                {[
                  ...(restaurant
                    ? [
                        {
                          icon: "restaurant-outline" as const,
                          label: "Restaurant",
                          value: restaurant.name,
                        },
                        ...(restaurant.address
                          ? [
                              {
                                icon: "location-outline" as const,
                                label: "Address",
                                value: restaurant.address,
                              },
                            ]
                          : []),
                      ]
                    : []),
                  { icon: "mail-outline" as const, label: "Email", value: booking.customerEmail },
                  {
                    icon: "calendar-outline" as const,
                    label: "Date",
                    value: new Date(booking.date).toLocaleDateString(undefined, {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }),
                  },
                  {
                    icon: "time-outline" as const,
                    label: "Time",
                    value: new Date(booking.date).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  },
                  {
                    icon: "people-outline" as const,
                    label: "Guests",
                    value: String(booking.seats),
                  },
                  ...(booking.specialRequests
                    ? [
                        {
                          icon: "chatbubble-outline" as const,
                          label: "Requests",
                          value: booking.specialRequests,
                        },
                      ]
                    : []),
                ].map(({ icon, label, value }, i) => (
                  <View key={label}>
                    {i > 0 && (
                      <View style={[styles.detailDivider, { backgroundColor: borderColor }]} />
                    )}
                    <View style={styles.detailRow}>
                      <Ionicons name={icon} size={15} color={mutedColor} />
                      <View style={styles.detailContent}>
                        <ThemedText style={[styles.detailLabel, { color: mutedColor }]}>
                          {label}
                        </ThemedText>
                        <ThemedText style={styles.detailValue}>{value}</ThemedText>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Recent bookings — only on narrow (wide shows them in left column) */}
        {!isWide && cached.length > 0 && (
          <View style={styles.recentSection}>
            <ThemedText style={[styles.recentTitle, { color: mutedColor }]}>
              YOUR RECENT BOOKINGS
            </ThemedText>
            {cached.map((c) => (
              <Pressable
                key={c.bookingRef}
                style={[styles.recentCard, { backgroundColor: cardBg, borderColor }]}
                onPress={async () => {
                  setRefInput(c.bookingRef);
                  setEmailInput(c.email);
                  setLoading(true);
                  setSearched(true);
                  const result = await getBookingByRef(c.bookingRef, c.email);
                  setBooking(result);
                  setLoading(false);
                }}
              >
                <View style={styles.recentCardRow}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <ThemedText style={styles.recentRef}>{c.bookingRef}</ThemedText>
                    <ThemedText style={[styles.recentMeta, { color: mutedColor }]}>
                      {c.restaurantName ? `${c.restaurantName} · ` : ""}
                      {new Date(c.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                      {" · "}
                      {c.seats} guest{c.seats !== 1 ? "s" : ""}
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward-outline" size={16} color={mutedColor} />
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </PageContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 60,
  },
  header: {
    alignItems: "center",
    gap: 8,
    marginTop: 48,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  wideRow: {
    flexDirection: "row",
    gap: 24,
    alignItems: "flex-start",
  },
  wideCol: {
    flex: 1,
  },
  searchCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    gap: 12,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  helpText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
  },
  searchBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  resultCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 24,
    marginTop: 20,
    width: "100%",
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  notFound: {
    fontSize: 15,
    textAlign: "center",
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  refBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  cardHeader: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
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
    alignItems: "center",
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
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "500",
  },
  detailDivider: {
    height: 1,
  },
  recentSection: {
    marginTop: 20,
    gap: 10,
    width: "100%",
  },
  recentTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  recentCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  recentCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  recentRef: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  recentMeta: {
    fontSize: 12,
  },
});
