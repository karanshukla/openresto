import { View, StyleSheet, Pressable, Platform } from "react-native";
import { Link, usePathname } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { PRIMARY } from "@/constants/colors";

const NAV_LINKS = [
  { label: "Explore", href: "/" as const, match: (p: string) => p === "/" },
  {
    label: "My Booking",
    href: "/explore" as const,
    match: (p: string) => p === "/explore" || p.startsWith("/booking"),
  },
];

export default function Navbar() {
  const pathname = usePathname();
  const isDark = useColorScheme() === "dark";
  const borderColor = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const mutedColor = isDark ? "#9ca3af" : "#6b7280";

  return (
    <ThemedView
      style={[
        styles.nav,
        { borderBottomColor: borderColor },
        Platform.OS === "web"
          ? ({ position: "sticky", top: 0, zIndex: 100 } as any)
          : undefined,
      ]}
    >
      <View style={styles.inner}>
        {/* Brand */}
        <Link href="/" asChild>
          <Pressable style={styles.brand}>
            <ThemedText style={styles.brandText}>Open Resto</ThemedText>
          </Pressable>
        </Link>

        {/* Nav links */}
        <View style={styles.links}>
          {NAV_LINKS.map(({ label, href, match }) => {
            const active = match(pathname);
            return (
              <Link key={href} href={href} asChild>
                <Pressable style={styles.linkBtn}>
                  <ThemedText
                    style={[
                      styles.linkText,
                      { color: active ? PRIMARY : mutedColor },
                    ]}
                  >
                    {label}
                  </ThemedText>
                  {active && (
                    <View
                      style={[styles.linkUnderline, { backgroundColor: PRIMARY }]}
                    />
                  )}
                </Pressable>
              </Link>
            );
          })}
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
    color: PRIMARY,
    letterSpacing: -0.5,
  },
  links: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    height: "100%",
  },
  linkBtn: {
    paddingHorizontal: 14,
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
});
