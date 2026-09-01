import { useEffect, useState } from "react";
import { Platform, useWindowDimensions, View } from "react-native";
import { Redirect, Slot, Stack, useRouter, usePathname, useSegments } from "expo-router";
import { useTranslation } from "react-i18next";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { theme } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import PageLoader from "@/components/common/PageLoader";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { focusTarget } from "@/utils/focusRegistry";
import KeyboardShortcutsHelp from "@/components/common/KeyboardShortcutsHelp";
import { styles } from "@/styles/admin/layout.styles";
import { Icon } from "@/components/common/Icon";

const MIN_WIDTH = 600;

function DesktopOnlyWall() {
  const { t } = useTranslation();
  return (
    <ThemedView style={styles.wall}>
      <Icon name="desktop-outline" size={48} color={theme.colors.primary} />
      <ThemedText style={styles.wallTitle}>{t("admin.layout.desktopWall.title")}</ThemedText>
      <ThemedText style={styles.wallBody}>{t("admin.layout.desktopWall.body")}</ThemedText>
    </ThemedView>
  );
}

/**
 * The admin is a web surface. The self-hoster's native build ships the guest routes only, so
 * on ios/android this layout hands the visitor back to the home screen rather than mounting a
 * dashboard whose every screen assumes a pointer, a keyboard and a browser session.
 *
 * @see [admin-layout.test.tsx](../../tests/app/admin-layout.test.tsx) — pins the redirect on
 * native and that web still mounts the admin.
 */
export default function AdminLayout() {
  if (Platform.OS !== "web") return <Redirect href="/" />;
  return <AdminLayoutWeb />;
}

function AdminLayoutWeb() {
  const { width } = useWindowDimensions();
  const showWall = width < MIN_WIDTH;

  // AdminLayoutInner stays mounted even when the wall is shown so that auth
  // state is preserved — unmounting it would reset the status to "loading" and
  // trigger an unnecessary session re-check (which can bounce the user to login).
  return (
    <AuthProvider>
      <View style={{ flex: 1 }}>
        {showWall && <DesktopOnlyWall />}
        <View style={[{ flex: 1 }, showWall && { display: "none" as const }]}>
          <AdminLayoutInner />
        </View>
      </View>
    </AuthProvider>
  );
}

function AdminLayoutInner() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  // useSegments() reflects the true current URL (a plain state read, no focus-
  // event lifecycle), unlike useIsFocused() which never fires on a cold web
  // load (page.goto() straight to a route never dispatches a "focus" nav
  // event) and would leave shortcutsEnabled stuck false. This also still
  // guards against the original scope-leak bug: once the user navigates to a
  // (user) route, segments[0] flips away from "admin" even though this
  // layout instance may remain mounted (React Navigation doesn't unmount
  // sibling stack screens on navigation).
  const isAdminRouteActive = segments[0] === "admin";
  const brand = useBrand();
  const { status: authState } = useAuth();

  useEffect(() => {
    /* istanbul ignore next */
    if (Platform.OS !== "web") return;

    /* istanbul ignore next */
    const PAGE_TITLES: Record<string, string> = {
      "/admin/dashboard": "Dashboard",
      "/admin/settings/brand": "Brand",
      "/admin/settings/email": "Email & Push",
      "/admin/settings/users": "Users",
      "/admin/settings/native-app": "Native app",
      "/admin/settings/account": "Account",
      "/admin/bookings": "Bookings",
      "/admin/bookings/new": "New Walk-in",
      "/admin/locations": "Locations",
      "/admin/notifications": "Notifications",
      "/admin/activity": "Activity",
      "/admin/login": "Admin Login",
    };
    /* istanbul ignore next */
    const title =
      PAGE_TITLES[pathname] ??
      (/^\/admin\/bookings\/\d+$/.test(pathname) ? "Booking Detail" : undefined);
    /* istanbul ignore next */
    if (title) document.title = `${title} | ${brand.appName}`;
  }, [pathname, brand.appName]);

  // AuthProvider resolves the session; the layout only reacts to the verdict. A rate-limited
  // /me deliberately does not reach "unauthenticated", so throttling never bounces a
  // signed-in admin to the login screen.
  useEffect(() => {
    if (authState === "unauthenticated" && pathname !== "/admin/login") {
      router.replace("/admin/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, pathname]);

  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const shortcutsEnabled =
    authState === "authenticated" && pathname !== "/admin/login" && isAdminRouteActive;

  useKeyboardShortcuts(
    shortcutsEnabled
      ? {
          "g d": () => router.push("/admin/dashboard"),
          "g b": () => router.push("/admin/bookings"),
          "g l": () => router.push("/admin/locations"),
          "g s": () => router.push("/admin/settings/brand"),
          "/": (e) => {
            e.preventDefault();
            router.push("/admin/bookings");
            focusTarget("admin-lookup");
          },
          c: () => router.push({ pathname: "/admin/bookings", params: { create: "1" } }),
          "?": () => setShowShortcutsHelp((v) => !v),
        }
      : {}
  );

  const nativeStack = (
    <Stack>
      <Stack.Screen name="login" options={{ title: "Admin Login", headerBackVisible: false }} />
      <Stack.Screen name="dashboard" options={{ title: "Dashboard", headerBackVisible: false }} />
      <Stack.Screen name="bookings/index" options={{ title: "Bookings" }} />
      <Stack.Screen name="bookings/[id]" options={{ title: "Booking Detail" }} />
      <Stack.Screen name="locations" options={{ title: "Locations" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
      <Stack.Screen name="activity" options={{ title: "Activity" }} />
      <Stack.Screen name="settings/index" options={{ title: "Settings" }} />
      <Stack.Screen name="settings/brand" options={{ title: "Brand" }} />
      <Stack.Screen name="settings/email" options={{ title: "Email & Push" }} />
      <Stack.Screen name="settings/users" options={{ title: "Users" }} />
      <Stack.Screen name="settings/account" options={{ title: "Account" }} />
    </Stack>
  );

  // The login screen is where you go to *get* a session, so it renders straight away rather
  // than sitting behind the loading state every other admin route waits on.
  if (pathname === "/admin/login") {
    /* istanbul ignore next */
    if (Platform.OS === "web") {
      return (
        <ThemedView style={{ flex: 1 }}>
          <Slot />
        </ThemedView>
      );
    }
    /* istanbul ignore next -- unreachable: AdminLayout redirects off native before
       this ever mounts. Kept so the admin still has a native shell if it is ever
       shipped there. */
    return nativeStack;
  }

  if (authState === "loading") return <PageLoader />;
  if (authState !== "authenticated") return null;

  /* istanbul ignore next */
  if (Platform.OS === "web") {
    return (
      <ThemedView style={{ flex: 1, flexDirection: "row" }}>
        <AdminSidebar />
        <View style={{ flex: 1 }}>
          <Slot />
        </View>
        <KeyboardShortcutsHelp
          visible={showShortcutsHelp}
          scope="admin"
          onClose={() => setShowShortcutsHelp(false)}
        />
      </ThemedView>
    );
  }

  /* istanbul ignore next -- unreachable: AdminLayout redirects off native before
     this ever mounts. Kept so the admin still has a native shell if it is ever
     shipped there. */
  return nativeStack;
}
