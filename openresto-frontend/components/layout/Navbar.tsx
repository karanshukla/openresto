import { View, StyleSheet, Pressable, Platform, useWindowDimensions } from "react-native";
import { Link, usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
    label: "My Bookings",
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
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const { toggle } = useTheme();
  const brand = useBrand();
  const accent = brand.primaryColor || COLORS.primary;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < 768;
  const isTiny = width < 380;
  const visibleLinks = isMobile ? NAV_LINKS.filter((l) => !l.adminOnly) : NAV_LINKS;
  const showBack = pathname !== "/";

  return (
    <ThemedView
      style={[
        styles.nav,
        {
          borderBottomColor: colors.border,
          paddingTop: insets.top,
          height: 64 + insets.top,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Platform.OS === "web" ? { position: "sticky" as any, top: 0, zIndex: 100 } : undefined,
      ]}
    >
      <View style={[styles.inner, isMobile && { paddingHorizontal: 12 }]}>
        <View style={styles.leftGroup}>
          {/* Back button — shown in standalone PWA mode on inner pages */}
          {showBack && (
            <Pressable
              onPress={() => router.back()}
              style={[styles.backBtn, isMobile && { marginLeft: -8 }]}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color={accent} />
            </Pressable>
          )}

          <Link href="/" asChild>
            <Pressable style={[styles.brand, { flexShrink: 1 }]}>
              {brand.logoUrl ? (
                <img
                  src={brand.logoUrl}
                  alt={brand.appName}
                  style={{ height: 32, objectFit: "contain" }}
                />
              ) : (
                <ThemedText
                  style={[
                    styles.brandText,
                    { color: accent },
                    isTiny && { fontSize: 18 },
                  ]}
                  numberOfLines={1}
                >
                  {brand.appName}
                </ThemedText>
              )}
            </Pressable>
          </Link>
        </View>

        {/* Nav links + theme toggle */}
        <View style={[styles.links, isMobile && { gap: 0 }]}>
          {visibleLinks.map(({ label, href, match }) => {
            const active = match(pathname);
            return (
              <Link key={href} href={href} asChild>
                <Pressable
                  style={[
                    styles.linkBtn,
                    isMobile && { paddingHorizontal: 10 },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.linkText,
                      { color: active ? accent : colors.muted },
                      isMobile && { fontSize: 14 },
                    ]}
                  >
                    {label}
                  </ThemedText>
                  {active && (
                    <View
                      style={[
                        styles.linkUnderline,
                        { backgroundColor: accent },
                        isMobile && { left: 8, right: 8 },
                      ]}
                    />
                  )}
                </Pressable>
              </Link>
            );
          })}

          <Pressable
            onPress={toggle}
            style={(state) => [
              styles.themeBtn,
              isMobile && { marginLeft: 0 },
              (state as { hovered?: boolean }).hovered && { opacity: 0.7 },
            ]}
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
    overflow: "hidden",
  },
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    marginRight: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -18,
    marginRight: 4,
  },
  brand: {
    paddingVertical: 4,
  },
  brandText: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  links: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    height: "100%",
    flexShrink: 0,
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
    cursor: "pointer" as const,
  },
});
