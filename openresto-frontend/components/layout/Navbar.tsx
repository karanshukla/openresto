import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
  ViewStyle,
} from "react-native";
import { Link, usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/context/ThemeContext";
import { BUTTON_SIZES, BORDER_RADIUS, TYPOGRAPHY } from "@/theme/theme";
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

const NAV_HEIGHT = 64;

interface NavbarProps {
  onScrollToTop?: () => void;
}

export default function Navbar({ onScrollToTop }: NavbarProps) {
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
      style={[
        styles.nav,
        {
          borderBottomColor: colors.border,
          paddingTop: insets.top,
          height: NAV_HEIGHT + insets.top,
        },
        Platform.OS === "web" &&
          ({
            position: "sticky",
            top: 0,
            zIndex: 100,
          } as unknown as ViewStyle),
      ]}
    >
      <View style={[styles.inner, isMobile && { paddingHorizontal: 12 }]}>
        <View style={styles.leftGroup}>
          {showBack && (
            <Pressable
              onPress={() => router.back()}
              style={[styles.backBtn, isMobile && { marginLeft: -8 }]}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color={primaryColor} />
            </Pressable>
          )}

          {pathname === "/" && onScrollToTop ? (
            <Pressable style={styles.brand} onPress={onScrollToTop}>
              <ThemedText
                style={[styles.brandText, { color: primaryColor }, isTiny && { fontSize: 18 }]}
                numberOfLines={1}
              >
                {brand.appName}
              </ThemedText>
            </Pressable>
          ) : (
            <Link href="/" asChild>
              <Pressable style={styles.brand}>
                <ThemedText
                  style={[styles.brandText, { color: primaryColor }, isTiny && { fontSize: 18 }]}
                  numberOfLines={1}
                >
                  {brand.appName}
                </ThemedText>
              </Pressable>
            </Link>
          )}
        </View>

        <View style={[styles.links, isMobile && { gap: 0 }]}>
          {visibleLinks.map(({ label, href, match }) => {
            const active = match(pathname);
            const isHomeActive = href === "/" && active && !!onScrollToTop;

            const linkContent = (
              <>
                <ThemedText
                  style={[
                    styles.linkText,
                    { color: active ? primaryColor : colors.muted },
                    isMobile && { fontSize: 14 },
                  ]}
                >
                  {label}
                </ThemedText>
                {active && (
                  <View
                    style={[
                      styles.linkUnderline,
                      { backgroundColor: primaryColor },
                      isMobile && { left: 8, right: 8 },
                    ]}
                  />
                )}
              </>
            );

            if (isHomeActive) {
              return (
                <Pressable
                  key={href}
                  style={StyleSheet.flatten([
                    styles.linkBtn,
                    isMobile && { paddingHorizontal: 10 },
                  ])}
                  onPress={onScrollToTop}
                >
                  {linkContent}
                </Pressable>
              );
            }

            return (
              <Link key={href} href={href} asChild>
                <Pressable
                  style={StyleSheet.flatten([
                    styles.linkBtn,
                    isMobile && { paddingHorizontal: 10 },
                  ])}
                >
                  {linkContent}
                </Pressable>
              </Link>
            );
          })}

          <Pressable
            onPress={toggle}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            style={({ hovered }: any) => [
              styles.themeBtn,
              isMobile && { marginLeft: 0 },
              hovered && { opacity: 0.7 },
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
    height: NAV_HEIGHT,
    justifyContent: "center",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: 1320,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 28,
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
    borderRadius: BORDER_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -18,
    marginRight: 4,
  },
  brand: {
    paddingVertical: 4,
    flexShrink: 1,
  },
  brandText: {
    ...TYPOGRAPHY.h2,
    fontSize: 20,
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
    borderRadius: BORDER_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
});
