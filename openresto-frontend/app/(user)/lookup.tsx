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
import { BUTTON_SIZES, getThemeColors } from "@/theme/theme";
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
    let cancelled = false;
    fetchCachedBookings().then((data) => {
      if (cancelled) return;
      setCached(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const colors = getThemeColors(isDark);
  const mutedColor = colors.muted;
  const cardBg = colors.card;
  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";

  const canSearch = refInput.trim() && emailInput.trim();

  // Calendar URL generation (only when booking is found)
  const calendarUrls =
    !loading && booking
      ? (() => {
          const ref = booking.bookingRef;
          const startDate = new Date(booking.date);
          const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
          const restaurantName = restaurant?.name ?? "Restaurant";
          const restaurantAddress = restaurant?.address ?? "";

          const calTitle = `Reservation at ${restaurantName}`;
          const calDescription = [
            `Booking ref: ${ref}`,
            `Guests: ${booking.seats}`,
            restaurantAddress ? `Address: ${restaurantAddress}` : "",
            booking.specialRequests ? `Requests: ${booking.specialRequests}` : "",
          ]
            .filter(Boolean)
            .join("\n");

          const fmtCal = (d: Date) =>
            d
              .toISOString()
              .replace(/[-:]/g, "")
              .replace(/\.\d{3}/, "");

          const googleUrl = `https://calendar.google.com/calendar/r/eventedit?text=${encodeURIComponent(calTitle)}&dates=${fmtCal(startDate)}/${fmtCal(endDate)}&details=${encodeURIComponent(calDescription)}&location=${encodeURIComponent(restaurantAddress)}`;

          const outlookUrl = `https://outlook.live.com/calendar/0/action/compose?subject=${encodeURIComponent(calTitle)}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&body=${encodeURIComponent(calDescription)}&location=${encodeURIComponent(restaurantAddress)}`;

          const downloadIcs = () => {
            const ics = [
              "BEGIN:VCALENDAR",
              "VERSION:2.0",
              "PRODID:-//OpenResto//Booking//EN",
              "BEGIN:VEVENT",
              `DTSTART:${fmtCal(startDate)}`,
              `DTEND:${fmtCal(endDate)}`,
              `SUMMARY:${calTitle}`,
              `DESCRIPTION:${calDescription.replace(/\n/g, "\\n")}`,
              restaurantAddress ? `LOCATION:${restaurantAddress}` : "",
              `UID:${ref}@openresto`,
              "END:VEVENT",
              "END:VCALENDAR",
            ]
              .filter(Boolean)
              .join("\r\n");
            const blob = new Blob([ics], { type: "text/calendar" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `reservation-${ref}.ics`;
            a.click();
            URL.revokeObjectURL(url);
          };

          return { googleUrl, outlookUrl, downloadIcs };
        })()
      : null;

  const googleCalendarUrl = calendarUrls?.googleUrl;
  const outlookCalendarUrl = calendarUrls?.outlookUrl;
  const downloadIcs = calendarUrls?.downloadIcs;

  const performLookup = async (ref: string, email: string) => {
    setLoading(true);
    setSearched(true);
    setRestaurant(null);
    try {
      const result = await getBookingByRef(ref, email);
      setBooking(result);
      if (result?.restaurantId) {
        const r = await fetchRestaurantById(result.restaurantId);
        setRestaurant(r);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = () => {
    const ref = refInput.trim();
    const email = emailInput.trim();
    if (!ref || !email) return;
    performLookup(ref, email);
  };

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.page }]}
      contentContainerStyle={styles.scrollContent}
      horizontal={false}
      showsHorizontalScrollIndicator={false}
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
                    onPress={() => {
                      setRefInput(c.bookingRef);
                      setEmailInput(c.email);
                      performLookup(c.bookingRef, c.email);
                    }}
                  >
                    <View style={styles.recentCardRow}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <ThemedText style={styles.recentRef}>{c.bookingRef}</ThemedText>
                        <ThemedText style={[styles.recentMeta, { color: colors.muted }]}>
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
                  isWide ? { marginTop: 0 } : { marginTop: 16 },
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
              <View
                style={[
                  styles.detailCard,
                  { backgroundColor: cardBg, borderColor },
                  isWide ? {} : { marginTop: 24 },
                ]}
              >
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

                {/* Calendar actions - only on web */}
                {Platform.OS === "web" && (
                  <View
                    style={[
                      styles.calendarSection,
                      { backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" },
                    ]}
                  >
                    <ThemedText style={[styles.calendarTitle, { color: mutedColor }]}>
                      ADD TO CALENDAR
                    </ThemedText>
                    <View style={styles.calendarActions}>
                      <Pressable
                        style={[
                          styles.calendarBtn,
                          {
                            backgroundColor: isDark
                              ? "rgba(66,133,244,0.12)"
                              : "rgba(66,133,244,0.06)",
                          },
                        ]}
                        onPress={() => window.open(googleCalendarUrl, "_blank")}
                      >
                        <Ionicons name="logo-google" size={16} color="#4285F4" />
                        <ThemedText style={[styles.calendarBtnText, { color: "#4285F4" }]}>
                          Google
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.calendarBtn,
                          {
                            backgroundColor: isDark
                              ? "rgba(0,120,212,0.12)"
                              : "rgba(0,120,212,0.06)",
                          },
                        ]}
                        onPress={() => window.open(outlookCalendarUrl, "_blank")}
                      >
                        <Ionicons name="calendar-outline" size={16} color="#0078D4" />
                        <ThemedText style={[styles.calendarBtnText, { color: "#0078D4" }]}>
                          Outlook
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.calendarBtn,
                          {
                            backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                          },
                        ]}
                        onPress={downloadIcs}
                      >
                        <Ionicons name="download-outline" size={16} color={mutedColor} />
                        <ThemedText style={[styles.calendarBtnText, { color: mutedColor }]}>
                          .ics
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                )}

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
                    value: `${booking.seats}${booking.tableSeats ? ` (Table for ${booking.tableSeats})` : ""}`,
                  },
                  ...(booking.tableName
                    ? [
                        {
                          icon: "grid-outline" as const,
                          label: "Table",
                          value: booking.sectionName
                            ? `${booking.tableName} (${booking.sectionName})`
                            : booking.tableName,
                        },
                      ]
                    : []),
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
          <View style={[styles.recentSection, { marginTop: 20 }]}>
            <ThemedText style={[styles.recentTitle, { color: mutedColor }]}>
              YOUR RECENT BOOKINGS
            </ThemedText>
            {cached.map((c) => (
              <Pressable
                key={c.bookingRef}
                style={[styles.recentCard, { backgroundColor: cardBg, borderColor }]}
                onPress={() => {
                  setRefInput(c.bookingRef);
                  setEmailInput(c.email);
                  performLookup(c.bookingRef, c.email);
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
  scroll: {
    flex: 1,
  },
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
    ...BUTTON_SIZES.primary,
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
    fontSize: 16,
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
  calendarSection: {
    padding: 16,
    borderRadius: 10,
    gap: 10,
  },
  calendarTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  calendarActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  calendarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    minWidth: 70,
    maxWidth: 100,
    justifyContent: "center",
  },
  calendarBtnText: {
    fontSize: 12,
    fontWeight: "600",
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
    flex: 1,
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
    flex: 1,
  },
  recentMeta: {
    fontSize: 12,
  },
});
