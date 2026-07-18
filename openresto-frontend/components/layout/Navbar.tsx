import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
  ViewStyle,
} from "react-native";
import { Link, usePathname, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/use-app-theme";
import OverflowMenu from "@/components/layout/OverflowMenu";

const NAV_LINKS = [
  {
    label: "Locations",
    href: "/(user)/locations" as const,
    match: (p: string) => p === "/locations" || p.startsWith("/locations/"),
  },
  {
    label: "My Bookings",
    href: "/(user)/lookup" as const,
    match: (p: string) => p === "/lookup" || p.startsWith("/booking-confirmation"),
  },
];

const NAV_HEIGHT = 64;

interface NavbarProps {
  onScrollToTop?: () => void;
  onOpenShortcuts?: () => void;
}

export default function Navbar({ onScrollToTop, onOpenShortcuts }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { brand, colors, primaryColor } = useAppTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isMobile = width < 768;
  const isTiny = width < 380;
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
          {NAV_LINKS.map(({ label, href, match }) => {
            const active = match(pathname);

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

            return (
              <Link key={href} href={href as Href} asChild>
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

          <OverflowMenu onOpenShortcuts={() => onOpenShortcuts?.()} />
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
    borderRadius: theme.borderRadius.md,
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
    ...theme.typography.h2,
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
    ...theme.buttonSizes.secondary,
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
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
});
