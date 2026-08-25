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
import { useTranslation } from "react-i18next";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/common/Icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import OverflowMenu from "@/components/layout/OverflowMenu";
import { isMobileWidth } from "@/constants/breakpoints";
import { NAV_HEIGHT, styles } from "./Navbar.styles";

interface NavbarProps {
  onScrollToTop?: () => void;
  onOpenShortcuts?: () => void;
}

export default function Navbar({ onScrollToTop, onOpenShortcuts }: NavbarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const { brand, colors, primaryColor } = useAppTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const NAV_LINKS = [
    {
      label: t("common.navbar.locationsLink"),
      href: "/(user)/locations" as const,
      match: (p: string) => p === "/locations" || p.startsWith("/locations/"),
    },
    {
      label: t("common.navbar.myBookingsLink"),
      href: "/(user)/lookup" as const,
      match: (p: string) => p === "/lookup" || p.startsWith("/booking-confirmation"),
    },
  ];

  const isMobile = isMobileWidth(width);
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
              accessibilityRole="button"
              accessibilityLabel={t("common.navbar.goBack")}
              hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
            >
              <Icon name="chevron-back" size={22} color={primaryColor} />
            </Pressable>
          )}

          {pathname === "/" && onScrollToTop ? (
            <Pressable
              style={styles.brand}
              onPress={onScrollToTop}
              accessibilityRole="button"
              accessibilityLabel={t("common.navbar.brandBackToTop", { appName: brand.appName })}
            >
              <ThemedText
                style={[styles.brandText, { color: primaryColor }, isTiny && { fontSize: 18 }]}
                numberOfLines={1}
              >
                {brand.appName}
              </ThemedText>
            </Pressable>
          ) : (
            <Link href="/" asChild>
              <Pressable
                style={styles.brand}
                accessibilityRole="link"
                accessibilityLabel={t("common.navbar.brandHome", { appName: brand.appName })}
              >
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

        <View style={[styles.links, isMobile && { gap: 0 }]} role="navigation">
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
                  accessibilityRole="link"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: active }}
                  aria-current={active ? "page" : undefined}
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
