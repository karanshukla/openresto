import { Platform, View } from "react-native";
import { Slot, Tabs } from "expo-router";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import Navbar from "@/components/layout/Navbar";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  // On web: hide the tab bar and use a top navbar instead.
  // Navigation between tabs is handled by Navbar links.
  if (Platform.OS === "web") {
    return (
      <View style={{ flex: 1 }}>
        <Navbar />
        <Slot />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "My Booking",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="calendar" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
