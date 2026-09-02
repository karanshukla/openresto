import "@/global.css";
import { Platform } from "react-native";
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  usePathname,
  useSegments,
  type Theme,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import "react-native-reanimated";

import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppThemeProvider } from "@/context/ThemeContext";
import UpdateRequired from "@/components/common/UpdateRequired";
import { currentAppVersion, isBelowMinimum } from "@/utils/appVersion";
import { BrandProvider, useBrand } from "@/context/BrandContext";
import { LocaleProvider } from "@/context/LocaleContext";
import { useAppTheme } from "@/hooks/use-app-theme";

/**
 * Expo Router binds an `ErrorBoundary` export to the segment that declares it, so the root
 * boundary has to be exported from the root layout. Declaring it as its own module under
 * `app/` instead turns it into a route, which is a different thing entirely.
 */
export { ErrorBoundary } from "@/components/common/RootErrorBoundary";

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
  const { colors, isDark, primaryColor } = useAppTheme();

  // React Navigation paints the native header from its own theme, not from the app's, so
  // without this every header on a device rendered the light DefaultTheme — a white bar
  // above a near-black page in dark mode. Web never showed it: its headers are the app's
  // own Navbar and the root Stack runs headerShown: false.
  const navigationTheme = useMemo<Theme>(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: primaryColor,
        background: colors.page,
        card: colors.card,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [isDark, primaryColor, colors]);

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

  // Web is never gated: a browser always has the current build, and the one screen the gate
  // renders would replace the whole site with a store instruction nobody could act on.
  if (Platform.OS !== "web" && isBelowMinimum(currentAppVersion(), brand.minimumAppVersion)) {
    return <UpdateRequired />;
  }

  return (
    <ThemeProvider value={navigationTheme}>
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
      {/* Not "auto": that reads the device scheme, which is the visitor's pick only while
          their preference is "system". An explicit light pick on a dark phone got light
          chrome under dark status-bar icons. */}
      <StatusBar style={isDark ? "light" : "dark"} />
    </ThemeProvider>
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
