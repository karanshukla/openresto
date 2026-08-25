import "@/global.css";
import { Platform } from "react-native";
import { Stack, usePathname, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppThemeProvider } from "@/context/ThemeContext";
import { BrandProvider, useBrand } from "@/context/BrandContext";
import { LocaleProvider } from "@/context/LocaleContext";
import { useAppTheme } from "@/hooks/use-app-theme";

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

function AppWithTheme() {
  const brand = useBrand();
  const pathname = usePathname();
  const segments = useSegments();
  const { colors } = useAppTheme();

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const setTabTitle = (page?: string) => {
      document.title = page ? `${page} | ${brand.appName}` : brand.appName;
    };

    const actualSegments = segments.filter((s) => !s.startsWith("("));
    const primarySegment = actualSegments[0];

    if (primarySegment === "admin") {
      // Admin routes own their own document.title via app/admin/_layout.tsx's
      // pathname-keyed PAGE_TITLES map — this generic per-segment fallback
      // can't distinguish /admin/dashboard from /admin/settings.
      return;
    }

    if (!primarySegment || (primarySegment as string) === "index") {
      setTabTitle();
    } else if (primarySegment === "book") {
      setTabTitle("Reserve a Table");
    } else if (primarySegment === "lookup") {
      setTabTitle("Find My Booking");
    } else if (primarySegment === "booking-confirmation") {
      setTabTitle("Booking Confirmed");
    } else if (primarySegment === "restaurant") {
      setTabTitle("Restaurant Details");
    } else {
      const fallbackTitle = primarySegment.charAt(0).toUpperCase() + primarySegment.slice(1);
      setTabTitle(fallbackTitle);
    }
  }, [segments, brand.appName, pathname]);

  useEffect(() => {
    if (Platform.OS !== "web" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          title: brand.appName,
          animation: Platform.OS === "web" ? "fade" : "default",
          // React Navigation paints its own light default (rgb(242,242,242)) inline on the
          // screen container, below everything the app renders. Nothing in global.css can
          // reach an inline style, and in dark mode the route transition's brief 0.88
          // opacity let that layer flash through the whole viewport.
          contentStyle: { backgroundColor: colors.page },
        }}
      >
        <Stack.Screen name="(user)" />
        <Stack.Screen name="admin" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <BrandProvider>
        <LocaleProvider>
          <AppThemeProvider>
            <AppWithTheme />
          </AppThemeProvider>
        </LocaleProvider>
      </BrandProvider>
    </SafeAreaProvider>
  );
}
