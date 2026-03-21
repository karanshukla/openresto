import { View, StyleSheet, Pressable, Platform } from "react-native";
import { Link, usePathname, useRouter } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { logout } from "@/api/auth";
import { PRIMARY, MUTED_LIGHT, MUTED_DARK } from "@/constants/colors";

const NAV_ITEMS = [
  {
    label: "Overview",
    href: "/(admin)/dashboard" as const,
    match: (p: string) => p === "/dashboard",
  },
  {
    label: "Reservations",
    href: "/(admin)/bookings" as const,
    match: (p: string) => p === "/bookings" || p.startsWith("/bookings/"),
  },
  {
    label: "Settings",
    href: "/(admin)/settings" as const,
    match: (p: string) => p === "/settings",
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const mutedColor = isDark ? MUTED_DARK : MUTED_LIGHT;
  const hoverBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
  const activeBg = isDark ? "rgba(10,126,164,0.15)" : "rgba(10,126,164,0.08)";

  const handleLogout = () => {
    logout();
    router.replace("/(admin)/login");
  };

  return (
    <ThemedView
      style={[
        styles.sidebar,
        { borderRightColor: borderColor },
      ]}
    >
      {/* Brand */}
      <View style={styles.brand}>
        <ThemedText style={styles.brandText}>Open Resto</ThemedText>
        <ThemedText style={[styles.brandSub, { color: mutedColor }]}>
          Admin
        </ThemedText>
      </View>

      <View style={[styles.divider, { backgroundColor: borderColor }]} />

      {/* Nav */}
      <View style={styles.nav}>
        {NAV_ITEMS.map(({ label, href, match }) => {
          const active = match(pathname);
          return (
            <Link key={href} href={href} asChild>
              <Pressable
                style={(state) => [
                  styles.navItem,
                  active
                    ? { backgroundColor: activeBg }
                    : (state as any).hovered && { backgroundColor: hoverBg },
                  { cursor: "pointer" } as any,
                ]}
              >
                <ThemedText
                  style={[
                    styles.navLabel,
                    active
                      ? { color: PRIMARY, fontWeight: "700" }
                      : { color: mutedColor },
                  ]}
                >
                  {label}
                </ThemedText>
                {active && (
                  <View
                    style={[
                      styles.activeBar,
                      { backgroundColor: PRIMARY },
                    ]}
                  />
                )}
              </Pressable>
            </Link>
          );
        })}
      </View>

      <View style={styles.spacer} />

      <View style={[styles.divider, { backgroundColor: borderColor }]} />

      {/* Footer: back to site + logout */}
      <View style={styles.footer}>
        <Link href="/" asChild>
          <Pressable
            style={(state) => [
              styles.footerItem,
              (state as any).hovered && { backgroundColor: hoverBg },
              { cursor: "pointer" } as any,
            ]}
          >
            <ThemedText style={[styles.footerText, { color: mutedColor }]}>
              ← Back to site
            </ThemedText>
          </Pressable>
        </Link>
        <Pressable
          style={(state) => [
            styles.footerItem,
            (state as any).hovered && { backgroundColor: hoverBg },
            { cursor: "pointer" } as any,
          ]}
          onPress={handleLogout}
        >
          <ThemedText style={[styles.footerText, { color: mutedColor }]}>
            Log out
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 220,
    height: "100%" as any,
    borderRightWidth: 1,
    paddingVertical: 8,
    // sticky on web
    ...(Platform.OS === "web"
      ? ({ position: "sticky", top: 0, height: "100vh" } as any)
      : {}),
  },
  brand: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 2,
  },
  brandText: {
    fontSize: 18,
    fontWeight: "800",
    color: PRIMARY,
    letterSpacing: -0.4,
  },
  brandSub: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
    marginVertical: 4,
  },
  nav: {
    paddingTop: 8,
    gap: 2,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 8,
    borderRadius: 8,
    position: "relative",
  },
  navLabel: {
    fontSize: 14,
    flex: 1,
  },
  activeBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginLeft: 4,
  },
  spacer: {
    flex: 1,
  },
  footer: {
    paddingTop: 4,
    gap: 2,
  },
  footerItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  footerText: {
    fontSize: 13,
  },
});
