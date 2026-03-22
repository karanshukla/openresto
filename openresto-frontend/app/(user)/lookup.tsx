import { ThemedText } from "@/components/themed-text";
import { getBookingByRef, BookingDto } from "@/api/bookings";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Input from "@/components/common/Input";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { PRIMARY, MUTED_LIGHT, MUTED_DARK } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import PageContainer from "@/components/layout/PageContainer";
import { getCachedBookings } from "@/utils/bookingCache";

export default function LookupScreen() {
  const [refInput, setRefInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [booking, setBooking] = useState<BookingDto | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const isDark = useColorScheme() === "dark";
  const cached = getCachedBookings();

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
    const result = await getBookingByRef(ref, email);
    setBooking(result);
    setLoading(false);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: pageBg }}
      contentContainerStyle={styles.scrollContent}
    >
      <PageContainer>
        <View style={styles.header}>
          <Ionicons name="search-outline" size={32} color={PRIMARY} />
          <ThemedText style={styles.title}>Find My Booking</ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
            Enter your booking reference and email to look up your reservation.
          </ThemedText>
        </View>

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
              { backgroundColor: PRIMARY },
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

        {!loading && searched && !booking && (
          <View style={[styles.resultCard, { backgroundColor: cardBg, borderColor }]}>
            <Ionicons name="alert-circle-outline" size={28} color={mutedColor} />
            <ThemedText style={[styles.notFound, { color: mutedColor }]}>
              No booking found matching that reference and email.
            </ThemedText>
          </View>
        )}

        {!loading && booking && (
          <View style={[styles.resultCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.resultHeader}>
              <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
              <ThemedText style={styles.resultTitle}>Reservation Found</ThemedText>
            </View>

            <View
              style={[
                styles.refBadge,
                { backgroundColor: isDark ? "rgba(10,126,164,0.15)" : "rgba(10,126,164,0.08)" },
              ]}
            >
              <ThemedText style={[styles.refText, { color: PRIMARY }]}>
                {booking.bookingRef}
              </ThemedText>
            </View>

            <View style={styles.detailGrid}>
              <View style={styles.detailRow}>
                <Ionicons name="mail-outline" size={15} color={mutedColor} />
                <View style={styles.detailContent}>
                  <ThemedText style={[styles.detailLabel, { color: mutedColor }]}>Email</ThemedText>
                  <ThemedText style={styles.detailValue}>{booking.customerEmail}</ThemedText>
                </View>
              </View>

              <View style={[styles.detailDivider, { backgroundColor: borderColor }]} />

              <View style={styles.detailRow}>
                <Ionicons name="people-outline" size={15} color={mutedColor} />
                <View style={styles.detailContent}>
                  <ThemedText style={[styles.detailLabel, { color: mutedColor }]}>
                    Guests
                  </ThemedText>
                  <ThemedText style={styles.detailValue}>{booking.seats}</ThemedText>
                </View>
              </View>

              <View style={[styles.detailDivider, { backgroundColor: borderColor }]} />

              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={15} color={mutedColor} />
                <View style={styles.detailContent}>
                  <ThemedText style={[styles.detailLabel, { color: mutedColor }]}>Date</ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {new Date(booking.date).toLocaleDateString(undefined, {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.detailDivider, { backgroundColor: borderColor }]} />

              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={15} color={mutedColor} />
                <View style={styles.detailContent}>
                  <ThemedText style={[styles.detailLabel, { color: mutedColor }]}>Time</ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {new Date(booking.date).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Recent bookings from local cache */}
        {cached.length > 0 && (
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
  searchCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    gap: 12,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
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
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
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
  detailGrid: {
    width: "100%",
    gap: 0,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
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
    marginTop: 32,
    gap: 10,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
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
