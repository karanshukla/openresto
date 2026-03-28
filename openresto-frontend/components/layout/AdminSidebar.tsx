import { View, StyleSheet, Pressable, Platform } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTheme } from "@/context/ThemeContext";
import { logout } from "@/api/auth";
import { COLORS, BUTTON_SIZES, getThemeColors } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { fetchRestaurants } from "@/api/restaurants";

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

  const hoverBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
  const activeBg = isDark ? "rgba(10,126,164,0.18)" : "rgba(10,126,164,0.09)";

  useEffect(() => {
    fetchRestaurants().then((data) => setLocationCount(data.length));
  }, []);

  const handleLogout = async () => {
    await logout();
    router.replace("/(admin)/login");
  };

  return (
    <ThemedView
      lightColor="#ffffff"
      style={[
        styles.sidebar,
        { borderRightColor: colors.border },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Platform.OS === "web" ? { position: "sticky" as any, top: 0 } : { height: "100%" },
      ]}
    >
      {/* Brand */}
      <View style={styles.brand}>
        <View style={[styles.brandIcon, { backgroundColor: PRIMARY }]}>
          <Ionicons name="restaurant-outline" size={16} color="#fff" />
        </View>
        <View style={styles.brandText}>
          <ThemedText style={styles.brandName}>{brand.appName}</ThemedText>
          <ThemedText style={[styles.brandSub, { color: colors.muted }]}>
            {locationCount > 0
              ? `Managing ${locationCount} location${locationCount !== 1 ? "s" : ""}`
              : "Admin Panel"}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Nav */}
      <View style={styles.nav}>
        {NAV_ITEMS.map(({ label, icon, href, match }) => {
          const active = match(pathname);
          return (
            <Pressable
              key={href}
              onPress={() => router.push(href)}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              style={(state: any) => [
                styles.navItem,
                active
                  ? { backgroundColor: activeBg }
                  : state.hovered && { backgroundColor: hoverBg },
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

      <View style={styles.spacer} />

      {/* New Booking CTA */}
      <View style={styles.ctaWrapper}>
        <Pressable
          style={[styles.ctaBtn, { backgroundColor: PRIMARY }]}
          onPress={() => router.push("/(admin)/bookings/new")}
        >
          <Ionicons name="add-circle-outline" size={16} color="#fff" />
          <ThemedText style={styles.ctaBtnText}>New Booking</ThemedText>
        </Pressable>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          onPress={() => router.push("/")}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          style={(state: any) => [styles.footerItem, state.hovered && { backgroundColor: hoverBg }]}
        >
          <Ionicons name="arrow-back-outline" size={15} color={colors.muted} />
          <ThemedText style={[styles.footerText, { color: colors.muted }]}>Back to site</ThemedText>
        </Pressable>
        <Pressable
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          style={(state: any) => [styles.footerItem, state.hovered && { backgroundColor: hoverBg }]}
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
          style={(state: any) => [styles.footerItem, state.hovered && { backgroundColor: hoverBg }]}
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
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    gap: 1,
  },
  brandName: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: 11,
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
    borderRadius: 8,
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
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  ctaBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
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
    ...BUTTON_SIZES.secondary,
    borderRadius: 8,
  },
  footerText: {
    fontSize: 13,
  },
});
