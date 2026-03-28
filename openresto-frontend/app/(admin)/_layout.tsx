import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import { Slot, Stack, useRouter, useSegments } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { useEffect, useState } from "react";
import { checkSession } from "@/api/auth";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/use-color-scheme";

import { COLORS, getThemeColors } from "@/theme/theme";

const MIN_WIDTH = 900;

function DesktopOnlyWall() {
  return (
    <ThemedView style={styles.wall}>
      <Ionicons name="desktop-outline" size={48} color={COLORS.primary} />
      <ThemedText style={styles.wallTitle}>Desktop only</ThemedText>
      <ThemedText style={styles.wallBody}>
        The admin dashboard is designed for desktop browsers.{"\n"}
        Please open it on a larger screen.
      </ThemedText>
    </ThemedView>
  );
}

export default function AdminLayout() {
  const { width } = useWindowDimensions();

  if (Platform.OS !== "web" || width < MIN_WIDTH) return <DesktopOnlyWall />;

  return <AdminLayoutInner />;
}

function AdminLayoutInner() {
  const router = useRouter();
  const segments = useSegments();
  const [authState, setAuthState] = useState<"loading" | "authenticated" | "unauthenticated">(
    "loading"
  );

  useEffect(() => {
    const onLoginScreen = segments.includes("login" as never);
    if (onLoginScreen) {
      setAuthState("authenticated");
      return;
    }

    if (authState === "authenticated") return;

    checkSession().then((session) => {
      if (session) {
        setAuthState("authenticated");
      } else {
        setAuthState("unauthenticated");
        router.replace("/(admin)/login");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);

  if (authState === "loading") return null;

  if (Platform.OS === "web") {
    const onLoginScreen = segments.includes("login" as never);
    if (onLoginScreen) {
      return (
        <ThemedView style={{ flex: 1 }}>
          <Slot />
        </ThemedView>
      );
    }
    return (
      <ThemedView style={{ flex: 1, flexDirection: "row" }}>
        <AdminSidebar />
        <View style={{ flex: 1 }}>
          <Slot />
        </View>
      </ThemedView>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="login" options={{ title: "Admin Login", headerBackVisible: false }} />
      <Stack.Screen name="dashboard" options={{ title: "Dashboard", headerBackVisible: false }} />
      <Stack.Screen name="bookings/index" options={{ title: "Bookings" }} />
      <Stack.Screen name="bookings/[id]" options={{ title: "Booking Detail" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  wall: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 32,
  },
  wallTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  wallBody: {
    fontSize: 15,
    textAlign: "center",
    opacity: 0.6,
    lineHeight: 24,
  },
});
