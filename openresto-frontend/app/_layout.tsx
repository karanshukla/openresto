import "@/global.css";
import { Platform } from "react-native";

// Synchronous theme init — runs at module load, before React mounts.
// This is the earliest possible moment to set the correct background.
// In production, the blocking <script> in +html.tsx runs even earlier.
if (Platform.OS === "web" && typeof document !== "undefined") {
  try {
    const saved = localStorage.getItem("openresto-theme");
    let scheme: string;
    if (saved === "light" || saved === "dark") {
      scheme = saved;
    } else {
      scheme = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    const bg = scheme === "dark" ? "#111214" : "#f2f3f5";
    document.documentElement.className = scheme;
    document.documentElement.style.backgroundColor = bg;
    if (document.body) {
      document.body.classList.add(scheme);
      document.body.style.backgroundColor = bg;
    }
  } catch {}
}

import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { AppThemeProvider, useTheme } from "@/context/ThemeContext";
import { BrandProvider, useBrand } from "@/context/BrandContext";

function AppWithTheme() {
  const { colorScheme } = useTheme();
  const brand = useBrand();
  const pathname = usePathname();

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (pathname === "/") {
      document.title = brand.appName;
    }
  }, [pathname, brand.appName]);

  useEffect(() => {
    if (Platform.OS !== "web" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false, title: brand.appName }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(user)" />
        <Stack.Screen name="(admin)" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <BrandProvider>
      <AppThemeProvider>
        <AppWithTheme />
      </AppThemeProvider>
    </BrandProvider>
  );
}
