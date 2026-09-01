import { View, Pressable, Platform, type ViewStyle } from "react-native";
import { usePathname, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { roleDisplayLabel, type Capability } from "@/constants/roles";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { hexToRgba } from "@/utils/colors";
import { useEffect, useState } from "react";
import { fetchRestaurants } from "@/api/restaurants";
import { getUnreadCount } from "@/api/notifications";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";
import { styles } from "./AdminSidebar.styles";
import { Icon, type IconName } from "@/components/common/Icon";
import { BrandGlyph } from "@/components/common/BrandGlyph";

interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  href: Href;
  match: (p: string) => boolean;
  /** When set, the entry only renders for a role that holds this capability. */
  capability?: Capability;
}

/** Module-scope labels would resolve before `LocaleContext` picks a locale and never
 * re-render on a language switch, so the nav is built fresh from `t` on every render. */
function getNavSections(t: TFunction): { heading: string; items: NavItem[] }[] {
  return [
    {
      heading: t("admin.sidebar.nav.sections.manage"),
      items: [
        {
          id: "overview",
          label: t("admin.sidebar.nav.items.overview"),
          icon: "grid-outline" as const,
          href: "/admin/dashboard" as const,
          match: (p: string) => p === "/admin/dashboard",
        },
        {
          id: "bookings",
          label: t("admin.sidebar.nav.items.bookings"),
          icon: "calendar-outline" as const,
          href: "/admin/bookings" as const,
          match: (p: string) => p === "/admin/bookings" || p.startsWith("/admin/bookings/"),
        },
        {
          id: "locations",
          label: t("admin.sidebar.nav.items.locations"),
          icon: "storefront-outline" as const,
          href: "/admin/locations" as const,
          match: (p: string) => p === "/admin/locations",
        },
        {
          id: "notifications",
          label: t("admin.sidebar.nav.items.notifications"),
          icon: "notifications-outline" as const,
          href: "/admin/notifications" as const,
          match: (p: string) => p === "/admin/notifications",
        },
        {
          id: "activity",
          label: t("admin.sidebar.nav.items.activity"),
          icon: "receipt-outline" as const,
          href: "/admin/activity" as const,
          match: (p: string) => p === "/admin/activity",
          capability: "view:audit" as const,
        },
      ],
    },
    {
      heading: t("admin.sidebar.nav.sections.configure"),
      items: [
        {
          id: "brand",
          label: t("admin.sidebar.nav.items.brand"),
          icon: "color-palette-outline" as const,
          // /admin/settings redirects here, so it owns the bare path's highlight too.
          href: "/admin/settings/brand" as const,
          match: (p: string) => p === "/admin/settings/brand" || p === "/admin/settings",
        },
        {
          id: "emailPush",
          label: t("admin.sidebar.nav.items.emailPush"),
          icon: "mail-outline" as const,
          href: "/admin/settings/email" as const,
          match: (p: string) => p === "/admin/settings/email",
        },
        {
          id: "users",
          label: t("admin.sidebar.nav.items.users"),
          icon: "people-outline" as const,
          href: "/admin/settings/users" as const,
          match: (p: string) => p === "/admin/settings/users",
          capability: "manage:users" as const,
        },
        {
          id: "apiKeys",
          label: t("admin.sidebar.nav.items.apiKeys"),
          icon: "key-outline" as const,
          href: "/admin/settings/api-keys" as const,
          match: (p: string) => p === "/admin/settings/api-keys",
          capability: "manage:api-keys" as const,
        },
        {
          id: "nativeApp",
          label: t("admin.sidebar.nav.items.nativeApp"),
          icon: "phone-portrait-outline" as const,
          href: "/admin/settings/native-app" as const,
          match: (p: string) => p === "/admin/settings/native-app",
        },
        {
          id: "account",
          label: t("admin.sidebar.nav.items.account"),
          icon: "person-circle-outline" as const,
          href: "/admin/settings/account" as const,
          match: (p: string) => p === "/admin/settings/account",
        },
      ],
    },
  ];
}

export default function AdminSidebar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const { colors, isDark, brand, primaryColor: PRIMARY } = useAppTheme();
  const { toggle } = useTheme();
  const { user, signOut, can } = useAuth();
  const navSections = getNavSections(t);
  const [locationCount, setLocationCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const insets = useSafeAreaInsets();

  const hoverBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
  const activeBg = isDark ? hexToRgba(PRIMARY, 0.18) : hexToRgba(PRIMARY, 0.09);

  useEffect(() => {
    fetchRestaurants().then((data) => setLocationCount(data.length));
  }, []);

  useEffect(() => {
    getUnreadCount().then(setUnreadNotifCount);
  }, [pathname]);

  const handleLogout = async () => {
    await signOut();
    router.replace("/admin/login");
  };

  return (
    <ThemedView
      lightColor={theme.colors.white}
      style={[
        styles.sidebar,
        {
          borderRightColor: colors.border,
          paddingTop: Math.max(insets.top, 8),
          paddingBottom: Math.max(insets.bottom, 8),
        },

        // Sticky and self-scrolling: the nav is tall enough now that a short viewport
        // would otherwise clip the footer (identity, theme toggle, log out).
        Platform.OS === "web"
          ? ({
              position: "sticky",
              top: 0,
              height: "100vh",
              overflowY: "auto",
            } as unknown as ViewStyle)
          : { height: "100%" },
      ]}
    >
      <View style={styles.brand}>
        <View style={[styles.brandIcon, { backgroundColor: PRIMARY }]}>
          <BrandGlyph iconId={brand.faviconIcon} size="md" color={theme.colors.white} />
        </View>
        <View style={styles.brandTextGroup}>
          <ThemedText style={styles.brandName} numberOfLines={1}>
            {brand.appName}
          </ThemedText>
          <ThemedText style={[styles.brandSub, { color: colors.muted }]} numberOfLines={1}>
            {locationCount > 0
              ? t("admin.sidebar.managingLocations", { count: locationCount })
              : t("admin.sidebar.adminPanel")}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.nav}>
        {navSections.map(({ heading, items }) => (
          <View key={heading} style={styles.navSection}>
            <ThemedText style={[styles.navHeading, { color: colors.muted }]}>
              {heading.toUpperCase()}
            </ThemedText>
            {items
              .filter((item) => !item.capability || can(item.capability))
              .map(({ id, label, icon, href, match }) => {
                const active = match(pathname);
                const showBadge = id === "notifications" && unreadNotifCount > 0;
                return (
                  <Pressable
                    key={id}
                    onPress={() => router.push(href)}
                    accessibilityRole="link"
                    accessibilityLabel={
                      showBadge
                        ? t("admin.sidebar.nav.unreadLabel", { label, count: unreadNotifCount })
                        : label
                    }
                    accessibilityState={{ selected: active }}
                    aria-current={active ? "page" : undefined}
                    style={(state) => [
                      styles.navItem,
                      active
                        ? { backgroundColor: activeBg }
                        : (state as { hovered?: boolean }).hovered && { backgroundColor: hoverBg },
                      { cursor: "pointer" } as const,
                    ]}
                  >
                    <View style={styles.navIcon}>
                      <Icon name={icon} size="lg" color={active ? PRIMARY : colors.muted} />
                      {showBadge && (
                        <View style={[styles.navBadge, { backgroundColor: PRIMARY }]}>
                          <ThemedText style={styles.navBadgeText}>
                            {unreadNotifCount > 99 ? "99+" : String(unreadNotifCount)}
                          </ThemedText>
                        </View>
                      )}
                    </View>
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
        ))}
      </View>

      <View style={styles.spacer} />

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.footer}>
        <View style={styles.languageSwitcher}>
          <LanguageSwitcher />
        </View>

        {user && (
          <View style={styles.identity} testID="sidebar-identity">
            <ThemedText style={styles.identityName} numberOfLines={1}>
              {user.displayName ?? user.email}
            </ThemedText>
            <View style={[styles.roleBadge, { backgroundColor: hexToRgba(PRIMARY, 0.12) }]}>
              <ThemedText style={[styles.roleBadgeText, { color: PRIMARY }]}>
                {roleDisplayLabel(user.role, t)}
              </ThemedText>
            </View>
          </View>
        )}
        <Pressable
          onPress={() => router.push("/")}
          accessibilityRole="link"
          accessibilityLabel={t("admin.sidebar.backToSite")}
          style={(state) => [
            styles.footerItem,
            (state as { hovered?: boolean }).hovered && { backgroundColor: hoverBg },
          ]}
        >
          <Icon name="arrow-back-outline" size={15} color={colors.muted} />
          <ThemedText style={[styles.footerText, { color: colors.muted }]}>
            {t("admin.sidebar.backToSite")}
          </ThemedText>
        </Pressable>
        <Pressable
          style={(state) => [
            styles.footerItem,
            (state as { hovered?: boolean }).hovered && { backgroundColor: hoverBg },
          ]}
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={
            isDark
              ? t("admin.sidebar.themeToggle.switchToLight")
              : t("admin.sidebar.themeToggle.switchToDark")
          }
        >
          <Icon name={isDark ? "sunny-outline" : "moon-outline"} size={15} color={colors.muted} />
          <ThemedText style={[styles.footerText, { color: colors.muted }]}>
            {isDark
              ? t("admin.sidebar.themeToggle.lightMode")
              : t("admin.sidebar.themeToggle.darkMode")}
          </ThemedText>
        </Pressable>
        <Pressable
          style={(state) => [
            styles.footerItem,
            (state as { hovered?: boolean }).hovered && { backgroundColor: hoverBg },
          ]}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel={t("admin.sidebar.logOut")}
        >
          <Icon name="log-out-outline" size={15} color={colors.muted} />
          <ThemedText style={[styles.footerText, { color: colors.muted }]}>
            {t("admin.sidebar.logOut")}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}
