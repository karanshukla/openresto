import { View, StyleSheet, Pressable, Platform, TextInput, ActivityIndicator } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTheme } from "@/context/ThemeContext";
import { logout } from "@/api/auth";
import { COLORS, BORDER_RADIUS, FORM_SIZES, TYPOGRAPHY, getThemeColors } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";
import { hexToRgba } from "@/utils/colors";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { fetchRestaurants } from "@/api/restaurants";
import { adminLookupBookings, getAdminBookings, BookingDetailDto } from "@/api/admin";
import { BookingDetailPopup } from "@/components/admin/bookings/BookingDetailPopup";

const NAV_ITEMS = [
  {
    label: "Overview",
    icon: "grid-outline" as const,
    href: "/(admin)/dashboard" as const,
    match: (p: string) => p === "/dashboard",
  },
  {
    label: "Bookings",
    icon: "calendar-outline" as const,
    href: "/(admin)/bookings" as const,
    match: (p: string) => p === "/bookings" || p.startsWith("/bookings/"),
  },
  {
    label: "Settings",
    icon: "settings-outline" as const,
    href: "/(admin)/settings" as const,
    match: (p: string) => p === "/settings",
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const { toggle } = useTheme();
  const [locationCount, setLocationCount] = useState(0);
  const brand = useBrand();
  const PRIMARY = brand.primaryColor || COLORS.primary;
  const insets = useSafeAreaInsets();

  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<"idle" | "not_found" | "multiple">("idle");
  const [upcomingBookings, setUpcomingBookings] = useState<BookingDetailDto[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);

  const hoverBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
  const activeBg = isDark ? hexToRgba(PRIMARY, 0.18) : hexToRgba(PRIMARY, 0.09);

  useEffect(() => {
    fetchRestaurants().then((data) => setLocationCount(data.length));
    const today = new Date().toISOString().split("T")[0];
    getAdminBookings(undefined, today, "active").then((data) => {
      const now = new Date();
      setUpcomingBookings(
        data
          .filter((b) => new Date(b.date) >= now)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .slice(0, 4)
      );
    });
  }, []);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const handleLookup = async () => {
    const q = lookupQuery.trim();
    if (!q) return;
    setLookupLoading(true);
    setLookupStatus("idle");
    try {
      const results = await adminLookupBookings(q);
      if (results.length === 0) {
        setLookupStatus("not_found");
      } else if (results.length === 1) {
        setLookupQuery("");
        setSelectedBookingId(results[0].id);
      } else {
        setLookupStatus("multiple");
        const isEmail = q.includes("@");
        router.push({
          pathname: "/(admin)/bookings",
          params: isEmail ? { email: q } : { bookingRef: q },
        });
      }
    } finally {
      setLookupLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/(admin)/login");
  };

  return (
    <ThemedView
      lightColor={COLORS.white}
      style={[
        styles.sidebar,
        {
          borderRightColor: colors.border,
          paddingTop: Math.max(insets.top, 8),
          paddingBottom: Math.max(insets.bottom, 8),
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Platform.OS === "web" ? { position: "sticky" as any, top: 0 } : { height: "100%" },
      ]}
    >
      <View style={styles.brand}>
        <View style={[styles.brandIcon, { backgroundColor: PRIMARY }]}>
          <Ionicons name="restaurant-outline" size={16} color={COLORS.white} />
        </View>
        <View style={styles.brandTextGroup}>
          <ThemedText style={styles.brandName} numberOfLines={1}>
            {brand.appName}
          </ThemedText>
          <ThemedText style={[styles.brandSub, { color: colors.muted }]} numberOfLines={1}>
            {locationCount > 0
              ? `Managing ${locationCount} location${locationCount !== 1 ? "s" : ""}`
              : "Admin Panel"}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.nav}>
        {NAV_ITEMS.map(({ label, icon, href, match }) => {
          const active = match(pathname);
          return (
            <Pressable
              key={href}
              onPress={() => router.push(href)}
              style={(state) => [
                styles.navItem,
                active
                  ? { backgroundColor: activeBg }
                  : (state as { hovered?: boolean }).hovered && { backgroundColor: hoverBg },
                { cursor: "pointer" } as const,
              ]}
            >
              <Ionicons
                name={icon}
                size={18}
                color={active ? PRIMARY : colors.muted}
                style={styles.navIcon}
              />
              <ThemedText
                style={[
                  styles.navLabel,
                  active ? { color: PRIMARY, fontWeight: "700" } : { color: colors.muted },
                ]}
              >
                {label}
              </ThemedText>
              {active && (
                <View
                  style={[styles.activeBar, { backgroundColor: PRIMARY }]}
                  pointerEvents="none"
                />
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.upcomingWrapper}>
        <View style={styles.upcomingHeader}>
          <ThemedText style={[styles.upcomingLabel, { color: colors.muted }]}>Upcoming</ThemedText>
          <Pressable onPress={() => router.push("/(admin)/bookings")}>
            <ThemedText style={[styles.upcomingAll, { color: PRIMARY }]}>View all</ThemedText>
          </Pressable>
        </View>
        {upcomingBookings.length === 0 ? (
          <ThemedText style={[styles.upcomingEmpty, { color: colors.muted }]}>
            No upcoming bookings today
          </ThemedText>
        ) : (
          upcomingBookings.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => setSelectedBookingId(b.id)}
              style={(state) => [
                styles.upcomingItem,
                (state as { hovered?: boolean }).hovered && { backgroundColor: hoverBg },
              ]}
            >
              <ThemedText style={[styles.upcomingTime, { color: PRIMARY }]}>
                {formatTime(b.date)}
              </ThemedText>
              <View style={styles.upcomingDetails}>
                <ThemedText
                  style={[styles.upcomingEmail, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {b.customerName ?? b.customerEmail.split("@")[0]}
                </ThemedText>
                <View style={styles.upcomingMeta}>
                  <Ionicons name="people-outline" size={11} color={colors.muted} />
                  <ThemedText style={[styles.upcomingSeats, { color: colors.muted }]}>
                    {b.seats} · {b.tableName}
                  </ThemedText>
                </View>
                <ThemedText
                  style={[styles.upcomingRestaurant, { color: colors.muted }]}
                  numberOfLines={1}
                >
                  {b.restaurantName}
                </ThemedText>
              </View>
            </Pressable>
          ))
        )}
      </View>

      <View style={styles.spacer} />

      <View style={styles.ctaWrapper}>
        <ThemedText style={[styles.lookupLabel, { color: colors.muted }]}>
          Lookup Booking
        </ThemedText>
        <TextInput
          style={[
            styles.lookupInput,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.input,
            },
          ]}
          placeholder="Email or reference…"
          placeholderTextColor={colors.muted}
          value={lookupQuery}
          onChangeText={(t) => {
            setLookupQuery(t);
            if (lookupStatus !== "idle") setLookupStatus("idle");
          }}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={handleLookup}
        />
        <Pressable
          onPress={handleLookup}
          disabled={lookupLoading || !lookupQuery.trim()}
          style={[
            styles.lookupBtn,
            { backgroundColor: PRIMARY },
            (!lookupQuery.trim() || lookupLoading) && { opacity: 0.5 },
          ]}
        >
          {lookupLoading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="search-outline" size={15} color={COLORS.white} />
              <ThemedText style={styles.lookupBtnText}>Search</ThemedText>
            </>
          )}
        </Pressable>
        {lookupStatus === "not_found" && (
          <ThemedText style={[styles.lookupHint, { color: COLORS.error }]}>
            No booking found.
          </ThemedText>
        )}
        {lookupStatus === "multiple" && (
          <ThemedText style={[styles.lookupHint, { color: PRIMARY }]}>
            Showing all matches…
          </ThemedText>
        )}
        {lookupStatus === "idle" && (
          <ThemedText style={[styles.lookupHint, { color: PRIMARY }]}>
            Partial matching search is supported
          </ThemedText>
        )}
      </View>

      <BookingDetailPopup
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
      />

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.footer}>
        <Pressable
          onPress={() => router.push("/")}
          style={(state) => [
            styles.footerItem,
            (state as { hovered?: boolean }).hovered && { backgroundColor: hoverBg },
          ]}
        >
          <Ionicons name="arrow-back-outline" size={15} color={colors.muted} />
          <ThemedText style={[styles.footerText, { color: colors.muted }]}>Back to site</ThemedText>
        </Pressable>
        <Pressable
          style={(state) => [
            styles.footerItem,
            (state as { hovered?: boolean }).hovered && { backgroundColor: hoverBg },
          ]}
          onPress={toggle}
          accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          <Ionicons
            name={isDark ? "sunny-outline" : "moon-outline"}
            size={15}
            color={colors.muted}
          />
          <ThemedText style={[styles.footerText, { color: colors.muted }]}>
            {isDark ? "Light mode" : "Dark mode"}
          </ThemedText>
        </Pressable>
        <Pressable
          style={(state) => [
            styles.footerItem,
            (state as { hovered?: boolean }).hovered && { backgroundColor: hoverBg },
          ]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={15} color={colors.muted} />
          <ThemedText style={[styles.footerText, { color: colors.muted }]}>Log out</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 230,
    borderRightWidth: 1,
    paddingVertical: 8,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTextGroup: {
    flex: 1,
    gap: 1,
  },
  brandName: {
    ...TYPOGRAPHY.bodyBold,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  brandSub: {
    ...TYPOGRAPHY.captionSmall,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    marginHorizontal: 12,
    marginVertical: 6,
  },
  nav: {
    paddingTop: 4,
    gap: 2,
    paddingHorizontal: 8,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.md,
    position: "relative",
    gap: 10,
  },
  navIcon: {
    width: 20,
  },
  navLabel: {
    fontSize: 14,
    flex: 1,
  },
  activeBar: {
    position: "absolute" as const,
    left: 0,
    top: "50%",
    marginTop: -8,
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  spacer: {
    flex: 1,
  },
  ctaWrapper: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 6,
  },
  lookupLabel: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: "700",
    paddingLeft: 2,
  },
  lookupInput: {
    height: FORM_SIZES.inputSmHeight,
    paddingHorizontal: FORM_SIZES.inputPaddingH,
    fontSize: 13,
    borderRadius: FORM_SIZES.inputBorderRadius,
    borderWidth: 1,
  },
  lookupBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: FORM_SIZES.inputSmHeight,
    borderRadius: FORM_SIZES.inputBorderRadius,
  },
  lookupBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "600",
  },
  lookupHint: {
    ...TYPOGRAPHY.captionSmall,
    paddingLeft: 2,
  },
  upcomingWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  upcomingHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  upcomingLabel: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: "700" as const,
  },
  upcomingAll: {
    fontSize: 11,
    fontWeight: "600" as const,
  },
  upcomingEmpty: {
    fontSize: 12,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  upcomingItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.md,
  },
  upcomingTime: {
    fontSize: 12,
    fontWeight: "700" as const,
    minWidth: 46,
  },
  upcomingDetails: {
    flex: 1,
    gap: 1,
  },
  upcomingEmail: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  upcomingMeta: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3,
  },
  upcomingSeats: {
    fontSize: 11,
  },
  upcomingRestaurant: {
    fontSize: 11,
  },
  footer: {
    paddingTop: 4,
    paddingHorizontal: 8,
    gap: 2,
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: BORDER_RADIUS.md,
  },
  footerText: {
    fontSize: 13,
  },
});
