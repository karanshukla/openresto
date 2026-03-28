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
  const pageBg = colors.page;
  const mutedColor = colors.muted;
  const borderColor = colors.border;

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
      <View style={[styles.center, { backgroundColor: pageBg }]}>
        <ActivityIndicator size="large" color={accent} />
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
        <Pressable style={[styles.retryBtn, { borderColor }]} onPress={() => router.replace("/")}>
          <ThemedText style={[styles.retryBtnText, { color: accent }]}>Back to Home</ThemedText>
        </Pressable>
      </View>
    );
  }

  const ref = booking.bookingRef ?? bookingRef;
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

  const rows: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    label: string;
    value: string;
  }[] = [
    { icon: "restaurant-outline", label: "Restaurant", value: restaurantName },
    ...(restaurantAddress
      ? [{ icon: "location-outline" as const, label: "Address", value: restaurantAddress }]
      : []),
    { icon: "mail-outline", label: "Email", value: booking.customerEmail },
    {
      icon: "calendar-outline",
      label: "Date",
      value: startDate.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    },
    {
      icon: "time-outline",
      label: "Time",
      value: startDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    },
    {
      icon: "people-outline",
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
  ];

  if (booking.specialRequests) {
    rows.push({ icon: "chatbubble-outline", label: "Requests", value: booking.specialRequests });
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.page }}
      contentContainerStyle={styles.scrollContent}
    >
      <PageContainer>
        {/* Success header */}
        <View style={styles.successHeader}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={32} color="#fff" />
          </View>
          <ThemedText style={styles.title}>Booking Confirmed</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.muted }]}>
            {booking.seats} {booking.seats === 1 ? "guest" : "guests"} at {restaurantName}. Save
            your reference below.
          </ThemedText>
        </View>

        {/* Booking reference */}
        <View
          style={[styles.refCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={[styles.refLabel, { color: colors.muted }]}>
            Booking Reference
          </ThemedText>
          <View style={styles.refRow}>
            <View
              style={[styles.refBadge, { backgroundColor: isDark ? `${accent}22` : `${accent}14` }]}
            >
              <ThemedText style={[styles.refValue, { color: accent }]}>{ref}</ThemedText>
            </View>
            {Platform.OS === "web" && (
              <Pressable
                style={[styles.copyBtn, { borderColor: colors.border }]}
                onPress={() => {
                  navigator.clipboard.writeText(ref);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                <Ionicons
                  name={copied ? "checkmark" : "copy-outline"}
                  size={14}
                  color={copied ? "#16a34a" : accent}
                />
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

        <View style={isWide ? styles.wideRow : styles.narrowGap}>
          {/* Details card */}
          <View
            style={[
              styles.detailCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              isWide && styles.wideCol,
            ]}
          >
            {rows.map(({ icon, label, value }, i) => (
              <View key={label}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                <View style={styles.detailRow}>
                  <Ionicons name={icon} size={15} color={colors.muted} />
                  <View style={styles.detailContent}>
                    <ThemedText style={[styles.detailLabel, { color: colors.muted }]}>
                      {label}
                    </ThemedText>
                    <ThemedText style={styles.detailValue}>{value}</ThemedText>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Calendar actions */}
          {Platform.OS === "web" && (
            <View style={isWide && styles.wideCol}>
              <View
                style={[
                  styles.actionCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <ThemedText style={[styles.actionTitle, { color: colors.muted }]}>
                  ADD TO CALENDAR
                </ThemedText>
                <Pressable
                  style={[
                    styles.actionBtn,
                    { backgroundColor: isDark ? "rgba(66,133,244,0.12)" : "rgba(66,133,244,0.06)" },
                  ]}
                  onPress={() => window.open(googleUrl, "_blank")}
                >
                  <Ionicons name="logo-google" size={18} color="#4285F4" />
                  <View style={styles.actionBtnContent}>
                    <ThemedText style={[styles.actionBtnText, { color: "#4285F4" }]}>
                      Google Calendar
                    </ThemedText>
                    <ThemedText style={[styles.actionBtnSub, { color: mutedColor }]}>
                      Opens in a new tab
                    </ThemedText>
                  </View>
                  <Ionicons name="open-outline" size={14} color={mutedColor} />
                </Pressable>

                <Pressable
                  style={[
                    styles.actionBtn,
                    { backgroundColor: isDark ? "rgba(0,120,212,0.12)" : "rgba(0,120,212,0.06)" },
                  ]}
                  onPress={() => window.open(outlookUrl, "_blank")}
                >
                  <Ionicons name="calendar-outline" size={18} color="#0078D4" />
                  <View style={styles.actionBtnContent}>
                    <ThemedText style={[styles.actionBtnText, { color: "#0078D4" }]}>
                      Outlook Calendar
                    </ThemedText>
                    <ThemedText style={[styles.actionBtnSub, { color: mutedColor }]}>
                      Opens in a new tab
                    </ThemedText>
                  </View>
                  <Ionicons name="open-outline" size={14} color={mutedColor} />
                </Pressable>

                <Pressable
                  style={[
                    styles.actionBtn,
                    { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" },
                  ]}
                  onPress={downloadIcs}
                >
                  <Ionicons name="download-outline" size={18} color={mutedColor} />
                  <View style={styles.actionBtnContent}>
                    <ThemedText style={styles.actionBtnText}>Download .ics</ThemedText>
                    <ThemedText style={[styles.actionBtnSub, { color: mutedColor }]}>
                      Apple Calendar, Thunderbird, etc.
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={mutedColor} />
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Navigation */}
        <View style={isWide ? styles.actionsWide : styles.actions}>
          <Pressable
            style={[styles.secondaryBtn, { borderColor }]}
            onPress={() => router.replace("/")}
          >
            <Ionicons name="home-outline" size={16} color={accent} />
            <ThemedText style={[styles.secondaryBtnText, { color: accent }]}>
              Back to Restaurants
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.secondaryBtn, { borderColor }]}
            onPress={() => router.push("/(user)/lookup")}
          >
            <Ionicons name="search-outline" size={16} color={accent} />
            <ThemedText style={[styles.secondaryBtnText, { color: accent }]}>
              Find My Booking
            </ThemedText>
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
    padding: 24,
  },
  notFoundText: {
    fontSize: 16,
    marginTop: 8,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  successHeader: {
    alignItems: "center",
    paddingTop: 48,
    paddingBottom: 16,
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
    maxWidth: 400,
  },
  refCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 12,
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
  refRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  refBadge: {
    ...BUTTON_SIZES.secondary,
    borderRadius: 10,
  },
  refValue: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  refHint: {
    fontSize: 12,
    textAlign: "center",
  },
  wideRow: {
    flexDirection: "row",
    gap: 20,
    alignItems: "flex-start",
    marginTop: 4,
  },
  narrowGap: {
    gap: 16,
    marginTop: 4,
  },
  wideCol: {
    flex: 1,
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
  actionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actionTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  actionBtnContent: {
    flex: 1,
    gap: 1,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  actionBtnSub: {
    fontSize: 11,
  },
  actions: {
    gap: 10,
    marginTop: 8,
  },
  actionsWide: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
