import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
  ViewStyle,
  Image,
} from "react-native";
import { Link, usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/context/ThemeContext";
import { BUTTON_SIZES } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/use-app-theme";

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
  const { toggle } = useTheme();
  const { brand, colors, primaryColor, isDark } = useAppTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isMobile = width < 768;
  const isTiny = width < 380;
  const visibleLinks = isMobile ? NAV_LINKS.filter((l) => !l.adminOnly) : NAV_LINKS;
  const showBack = pathname !== "/";

  return (
    <ThemedView
      style={StyleSheet.flatten([
        styles.nav,
        {
          borderBottomColor: colors.border,
          paddingTop: insets.top,
          height: 64 + insets.top,
        },
        Platform.OS === "web" &&
          ({
            position: "sticky",
            top: 0,
            zIndex: 100,
          } as unknown as ViewStyle),
      ])}
    >
      <View style={StyleSheet.flatten([styles.inner, isMobile && { paddingHorizontal: 12 }])}>
        <View style={styles.leftGroup}>
          {showBack && (
            <Pressable
              onPress={() => router.back()}
              style={StyleSheet.flatten([styles.backBtn, isMobile && { marginLeft: -8 }])}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color={primaryColor} />
            </Pressable>
          )}

          <Link href="/" asChild>
            <Pressable style={StyleSheet.flatten([styles.brand, { flexShrink: 1 }])}>
              {brand.logoUrl ? (
                <Image
                  source={{ uri: brand.logoUrl }}
                  style={{ height: 32, width: 120, resizeMode: "contain" }}
                  accessibilityLabel={brand.appName}
                />
              ) : (
                <ThemedText
                  style={StyleSheet.flatten([
                    styles.brandText,
                    { color: primaryColor },
                    isTiny && { fontSize: 18 },
                  ])}
                  numberOfLines={1}
                >
                  {brand.appName}
                </ThemedText>
              )}
            </Pressable>
          </Link>
        </View>

        <View style={StyleSheet.flatten([styles.links, isMobile && { gap: 0 }])}>
          {visibleLinks.map(({ label, href, match }) => {
            const active = match(pathname);
            return (
              <Link key={href} href={href} asChild>
                <Pressable
                  style={StyleSheet.flatten([
                    styles.linkBtn,
                    isMobile && { paddingHorizontal: 10 },
                  ])}
                >
                  <ThemedText
                    style={StyleSheet.flatten([
                      styles.linkText,
                      { color: active ? primaryColor : colors.muted },
                      isMobile && { fontSize: 14 },
                    ])}
                  >
                    {label}
                  </ThemedText>
                  {active && (
                    <View
                      style={StyleSheet.flatten([
                        styles.linkUnderline,
                        { backgroundColor: primaryColor },
                        isMobile && { left: 8, right: 8 },
                      ])}
                    />
                  )}
                </Pressable>
              </Link>
            );
          })}

          <Pressable
            onPress={toggle}
            style={({ hovered }: { hovered?: boolean }) =>
              StyleSheet.flatten([
                styles.themeBtn,
                isMobile && { marginLeft: 0 },
                hovered && { opacity: 0.7 },
              ])
            }
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
  },
});
