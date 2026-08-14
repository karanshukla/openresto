import {
  View,
  Pressable,
  Platform,
  TextInput,
  ActivityIndicator,
  type ViewStyle,
} from "react-native";
import { usePathname, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { roleLabel, type Capability } from "@/constants/roles";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { hexToRgba } from "@/utils/colors";
import { useEffect, useRef, useState } from "react";
import { fetchRestaurants } from "@/api/restaurants";
import { adminLookupBookings } from "@/api/admin";
import { getUnreadCount } from "@/api/notifications";
import { BookingDetailPopup } from "@/components/admin/bookings/BookingDetailPopup";
import { registerFocusTarget, unregisterFocusTarget } from "@/utils/focusRegistry";
import { styles } from "./AdminSidebar.styles";
import { Icon, type IconName } from "@/components/common/Icon";

interface NavItem {
  label: string;
  icon: IconName;
  href: Href;
  match: (p: string) => boolean;
  /** When set, the entry only renders for a role that holds this capability. */
  capability?: Capability;
}

const NAV_SECTIONS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Manage",
    items: [
      {
        label: "Overview",
        icon: "grid-outline" as const,
        href: "/admin/dashboard" as const,
        match: (p: string) => p === "/admin/dashboard",
      },
      {
        label: "Bookings",
        icon: "calendar-outline" as const,
        href: "/admin/bookings" as const,
        match: (p: string) => p === "/admin/bookings" || p.startsWith("/admin/bookings/"),
      },
      {
        label: "Locations",
        icon: "storefront-outline" as const,
        href: "/admin/locations" as const,
        match: (p: string) => p === "/admin/locations",
      },
      {
        label: "Notifications",
        icon: "notifications-outline" as const,
        href: "/admin/notifications" as const,
        match: (p: string) => p === "/admin/notifications",
      },
    ],
  },
  {
    heading: "Configure",
    items: [
      {
        label: "Brand",
        icon: "color-palette-outline" as const,
        // /admin/settings redirects here, so it owns the bare path's highlight too.
        href: "/admin/settings/brand" as const,
        match: (p: string) => p === "/admin/settings/brand" || p === "/admin/settings",
      },
      {
        label: "Email & Push",
        icon: "mail-outline" as const,
        href: "/admin/settings/email" as const,
        match: (p: string) => p === "/admin/settings/email",
      },
      {
        label: "Users",
        icon: "people-outline" as const,
        href: "/admin/settings/users" as const,
        match: (p: string) => p === "/admin/settings/users",
        capability: "manage:users" as const,
      },
      {
        label: "Account",
        icon: "person-circle-outline" as const,
        href: "/admin/settings/account" as const,
        match: (p: string) => p === "/admin/settings/account",
      },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { colors, isDark, brand, primaryColor: PRIMARY } = useAppTheme();
  const { toggle } = useTheme();
  const { user, signOut, can } = useAuth();
  const [locationCount, setLocationCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const insets = useSafeAreaInsets();

  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<"idle" | "not_found" | "multiple">("idle");
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const lookupInputRef = useRef<TextInput>(null);

  const hoverBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
  const activeBg = isDark ? hexToRgba(PRIMARY, 0.18) : hexToRgba(PRIMARY, 0.09);

  useEffect(() => {
    fetchRestaurants().then((data) => setLocationCount(data.length));
  }, []);

  useEffect(() => {
    registerFocusTarget("admin-lookup", lookupInputRef);
    return () => unregisterFocusTarget("admin-lookup");
  }, []);

  useEffect(() => {
    getUnreadCount().then(setUnreadNotifCount);
  }, [pathname]);

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
          pathname: "/admin/bookings",
          params: isEmail ? { email: q } : { bookingRef: q },
        });
      }
    } finally {
      setLookupLoading(false);
    }
  };

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
          <Icon name="restaurant-outline" size="md" color={theme.colors.white} />
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
        {NAV_SECTIONS.map(({ heading, items }) => (
          <View key={heading} style={styles.navSection}>
            <ThemedText style={[styles.navHeading, { color: colors.muted }]}>
              {heading.toUpperCase()}
            </ThemedText>
            {items
              .filter((item) => !item.capability || can(item.capability))
              .map(({ label, icon, href, match }) => {
                const active = match(pathname);
                const showBadge = label === "Notifications" && unreadNotifCount > 0;
                return (
                  <Pressable
                    key={label}
                    onPress={() => router.push(href)}
                    accessibilityRole="link"
                    accessibilityLabel={showBadge ? `${label}, ${unreadNotifCount} unread` : label}
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

      <View style={styles.ctaWrapper}>
        <ThemedText style={[styles.lookupLabel, { color: colors.muted }]}>
          Lookup Booking
        </ThemedText>
        <TextInput
          ref={lookupInputRef}
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
          accessibilityRole="button"
          accessibilityLabel="Search bookings"
          accessibilityState={{
            disabled: lookupLoading || !lookupQuery.trim(),
            busy: lookupLoading,
          }}
          style={[
            styles.lookupBtn,
            { backgroundColor: PRIMARY },
            (!lookupQuery.trim() || lookupLoading) && { opacity: 0.5 },
          ]}
        >
          {lookupLoading ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <>
              <Icon name="search-outline" size={15} color={theme.colors.white} />
              <ThemedText style={styles.lookupBtnText}>Search</ThemedText>
            </>
          )}
        </Pressable>
        {lookupStatus === "not_found" && (
          <ThemedText style={[styles.lookupHint, { color: theme.colors.error }]}>
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
        {user && (
          <View style={styles.identity} testID="sidebar-identity">
            <ThemedText style={styles.identityName} numberOfLines={1}>
              {user.displayName ?? user.email.split("@")[0]}
            </ThemedText>
            <View style={[styles.roleBadge, { backgroundColor: hexToRgba(PRIMARY, 0.12) }]}>
              <ThemedText style={[styles.roleBadgeText, { color: PRIMARY }]}>
                {roleLabel(user.role)}
              </ThemedText>
            </View>
          </View>
        )}
        <Pressable
          onPress={() => router.push("/")}
          accessibilityRole="link"
          accessibilityLabel="Back to site"
          style={(state) => [
            styles.footerItem,
            (state as { hovered?: boolean }).hovered && { backgroundColor: hoverBg },
          ]}
        >
          <Icon name="arrow-back-outline" size={15} color={colors.muted} />
          <ThemedText style={[styles.footerText, { color: colors.muted }]}>Back to site</ThemedText>
        </Pressable>
        <Pressable
          style={(state) => [
            styles.footerItem,
            (state as { hovered?: boolean }).hovered && { backgroundColor: hoverBg },
          ]}
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          <Icon name={isDark ? "sunny-outline" : "moon-outline"} size={15} color={colors.muted} />
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
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          <Icon name="log-out-outline" size={15} color={colors.muted} />
          <ThemedText style={[styles.footerText, { color: colors.muted }]}>Log out</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}
