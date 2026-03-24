import "@/global.css";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import "react-native-reanimated";

import { AppThemeProvider, useTheme } from "@/context/ThemeContext";
import { BrandProvider } from "@/context/BrandContext";

function AppWithTheme() {
  const { colorScheme } = useTheme();
  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(user)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

function usePWA() {
  useEffect(() => {
    if (Platform.OS !== "web") return;

    // Inject manifest link
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = "/manifest.json";
      document.head.appendChild(link);
    }

    // Inject theme-color meta
    if (!document.querySelector('meta[name="theme-color"]')) {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = "#0a7ea4";
      document.head.appendChild(meta);
    }

    // Inject apple-mobile-web-app meta tags
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const capable = document.createElement("meta");
      capable.name = "apple-mobile-web-app-capable";
      capable.content = "yes";
      document.head.appendChild(capable);

      const statusBar = document.createElement("meta");
      statusBar.name = "apple-mobile-web-app-status-bar-style";
      statusBar.content = "default";
      document.head.appendChild(statusBar);
    }

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failed — non-critical, app works without it
      });
    }
  }, []);
}

export default function RootLayout() {
  usePWA();

  return (
    <BrandProvider>
      <AppThemeProvider>
        <AppWithTheme />
      </AppThemeProvider>
    </BrandProvider>
  );
}
