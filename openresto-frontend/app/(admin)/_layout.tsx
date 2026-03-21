import { Platform, View } from "react-native";
import { Slot, Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { getStoredToken } from "@/api/auth";
import AdminSidebar from "@/components/layout/AdminSidebar";

export default function AdminLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = getStoredToken();
    const onLoginScreen = segments.includes("login" as never);

    if (!token && !onLoginScreen) {
      router.replace("/(admin)/login");
    }
    setChecked(true);
  }, [segments]);

  if (!checked) return null;

  // On web: sidebar + content layout (skip sidebar on login screen)
  if (Platform.OS === "web") {
    const onLoginScreen = segments.includes("login" as never);
    if (onLoginScreen) {
      return <Slot />;
    }
    return (
      <View style={{ flex: 1, flexDirection: "row" }}>
        <AdminSidebar />
        <View style={{ flex: 1, overflow: "auto" as any }}>
          <Slot />
        </View>
      </View>
    );
  }

  // On native: standard Stack with headers
  return (
    <Stack>
      <Stack.Screen
        name="login"
        options={{ title: "Admin Login", headerBackVisible: false }}
      />
      <Stack.Screen
        name="dashboard"
        options={{ title: "Dashboard", headerBackVisible: false }}
      />
      <Stack.Screen name="bookings/index" options={{ title: "Bookings" }} />
      <Stack.Screen
        name="bookings/[id]"
        options={{ title: "Booking Detail" }}
      />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
    </Stack>
  );
}
