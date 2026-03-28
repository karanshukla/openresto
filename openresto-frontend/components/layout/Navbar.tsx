import { View, StyleSheet, Pressable, Platform, useWindowDimensions } from "react-native";
import { Link, usePathname } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTheme } from "@/context/ThemeContext";
import { COLORS, BUTTON_SIZES, getThemeColors } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";
import { Ionicons } from "@expo/vector-icons";

const NAV_LINKS = [
  { label: "Home", href: "/" as const, match: (p: string) => p === "/", adminOnly: false },
  {
    label: "My Booking",
    href: "/(user)/lookup" as const,
    match: (p: string) => p === "/lookup" || p.startsWith("/booking-confirmation"),
    adminOnly: false,
  },
  {
    label: "Admin",
    href: "/(admin)/dashboard" as const,
    match: (p: string) =>
      p === "/dashboard" || p.startsWith("/bookings") || p === "/settings" || p === "/login",
    adminOnly: true,
  },
];

export default function Navbar() {
  const pathname = usePathname();
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const { toggle } = useTheme();
  const brand = useBrand();
  const accent = brand.primaryColor || COLORS.primary;
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const visibleLinks = isMobile ? NAV_LINKS.filter((l) => !l.adminOnly) : NAV_LINKS;

  return (
    <ThemedView
      style={[
        styles.nav,
        { borderBottomColor: colors.border },
        Platform.OS === "web" ? { position: "sticky" as const, top: 0, zIndex: 100 } : undefined,
      ]}
    >
      <View style={styles.inner}>
        {/* Brand */}
        <Link href="/" asChild>
          <Pressable style={styles.brand}>
            {brand.logoUrl ? (
              <img
                src={brand.logoUrl}
                alt={brand.appName}
                style={{ height: 32, objectFit: "contain" }}
              />
            ) : (
              <ThemedText style={[styles.brandText, { color: accent }]}>{brand.appName}</ThemedText>
            )}
          </Pressable>
        </Link>

        {/* Nav links + theme toggle */}
        <View style={styles.links}>
          {visibleLinks.map(({ label, href, match }) => {
            const active = match(pathname);
            return (
              <Link key={href} href={href} asChild>
                <Pressable style={styles.linkBtn}>
                  <ThemedText style={[styles.linkText, { color: active ? accent : colors.muted }]}>
                    {label}
                  </ThemedText>
                  {active && <View style={[styles.linkUnderline, { backgroundColor: accent }]} />}
                </Pressable>
              </Link>
            );
          })}

          <Pressable
            onPress={toggle}
            style={(state) => [styles.themeBtn, (state as { hovered?: boolean }).hovered && { opacity: 0.7 }]}
            accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <Ionicons
              name={isDark ? "sunny-outline" : "moon-outline"}
              size={19}
              color={colors.muted}
            />
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  nav: {
    width: "100%",
    borderBottomWidth: 1,
    height: 64,
    justifyContent: "center",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 24,
    height: "100%",
  },
  brand: {
    paddingVertical: 4,
  },
  brandText: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  links: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    height: "100%",
  },
  linkBtn: {
    ...BUTTON_SIZES.secondary,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  linkText: {
    fontSize: 15,
    fontWeight: "500",
  },
  linkUnderline: {
    position: "absolute",
    bottom: 0,
    left: 14,
    right: 14,
    height: 2,
    borderRadius: 2,
  },
  themeBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
    cursor: "pointer" as any,
  },
});
