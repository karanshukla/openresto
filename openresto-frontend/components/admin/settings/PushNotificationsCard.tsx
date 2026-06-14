import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View, Pressable, Platform, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, BORDER_RADIUS } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { hexToRgba } from "@/utils/colors";
import { getVapidPublicKey, subscribePush, unsubscribePush } from "@/api/notifications";
import { fetchRestaurants } from "@/api/restaurants";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { styles } from "./settings.styles";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

type PushState = "loading" | "unconfigured" | "unavailable" | "denied" | "active" | "inactive";

export function PushNotificationsCard() {
  const { colors, primaryColor, isDark } = useAppTheme();
  const borderColor = colors.border;
  const mutedColor = colors.muted;
  const cardBg = colors.card;

  const [expanded, setExpanded] = usePersistedState("settings:push:expanded", true);
  const [vapidKey, setVapidKey] = useState<string | null | undefined>(undefined);
  const [pushState, setPushState] = useState<PushState>("loading");
  const [working, setWorking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVapidKey(null);
      setPushState("unavailable");
      return;
    }
    getVapidPublicKey().then((key) => {
      setVapidKey(key ?? null);
      if (key == null) {
        setPushState("unconfigured");
        return;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setPushState("unavailable");
        return;
      }
      if (Notification.permission === "denied") {
        setPushState("denied");
        return;
      }
      navigator.serviceWorker.ready.then(async (sw) => {
        const existing = await sw.pushManager.getSubscription();
        setPushState(existing ? "active" : "inactive");
      });
    });
  }, []);

  if (vapidKey === undefined) return null;
  if (Platform.OS !== "web" && pushState === "unavailable") return null;

  const handleEnable = async () => {
    if (!vapidKey) return;
    setWorking(true);
    setErrorMsg(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setPushState("denied");
        setErrorMsg("Notifications blocked. Enable them in your browser settings.");
        setWorking(false);
        return;
      }
      if (permission !== "granted") {
        setWorking(false);
        return;
      }

      const sw = await navigator.serviceWorker.ready;
      const sub = await sw.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const p256dhBuffer = sub.getKey("p256dh");
      const authBuffer = sub.getKey("auth");
      if (!p256dhBuffer || !authBuffer) throw new Error("Missing push keys");

      const payload = {
        endpoint: sub.endpoint,
        p256dh: arrayBufferToBase64(p256dhBuffer),
        auth: arrayBufferToBase64(authBuffer),
      };

      // Register this browser for every location so all push alerts arrive.
      const restaurants = await fetchRestaurants();
      await Promise.all(restaurants.map((r) => subscribePush(r.id, payload)));

      setPushState("active");
    } catch (err) {
      console.error("Push subscribe error:", err);
      setErrorMsg("Failed to enable push notifications.");
    }
    setWorking(false);
  };

  const handleDisable = async () => {
    setWorking(true);
    setErrorMsg(null);
    try {
      const sw = await navigator.serviceWorker.ready;
      const sub = await sw.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await unsubscribePush(sub.endpoint);
      }
      setPushState("inactive");
    } catch (err) {
      console.error("Push unsubscribe error:", err);
      setErrorMsg("Failed to disable push notifications.");
    }
    setWorking(false);
  };

  const isActive = pushState === "active";
  const isDenied = pushState === "denied";
  const isUnconfigured = pushState === "unconfigured";

  const iconColor = isDenied || isUnconfigured ? COLORS.warning : primaryColor;
  const iconBg =
    isDenied || isUnconfigured ? hexToRgba(COLORS.warning, 0.1) : hexToRgba(primaryColor, 0.1);
  const stateIcon: "notifications-outline" | "notifications-off-outline" = isDenied
    ? "notifications-off-outline"
    : "notifications-outline";

  const stateSub =
    pushState === "loading"
      ? "Checking status…"
      : isActive
        ? "Push notifications active for all locations"
        : isDenied
          ? "Notifications blocked — enable in browser settings"
          : isUnconfigured
            ? "VAPID keys not configured"
            : pushState === "unavailable"
              ? "Not supported in this browser"
              : "Enable to receive real-time booking alerts";

  return (
    <View style={[styles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <Pressable style={styles.secHeader} onPress={() => setExpanded((v) => !v)}>
        <View style={[styles.secIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={stateIcon} size={20} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.secTitle}>Push Notifications</ThemedText>
          <ThemedText
            style={[
              styles.secSub,
              { color: isUnconfigured || isDenied ? COLORS.warning : mutedColor },
            ]}
          >
            {stateSub}
          </ThemedText>
        </View>
        {pushState === "loading" ? (
          <ActivityIndicator size="small" color={primaryColor} />
        ) : (
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={mutedColor} />
        )}
      </Pressable>

      <AnimatedAccordion expanded={expanded}>
        {pushState !== "loading" && (
          <View style={[styles.secForm, { borderTopColor: borderColor }]}>
            {isUnconfigured ? (
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <Ionicons
                  name="warning-outline"
                  size={16}
                  color={COLORS.warning}
                  style={{ marginTop: 1 }}
                />
                <ThemedText style={{ fontSize: 13, color: mutedColor, flex: 1, lineHeight: 19 }}>
                  Push notifications require VAPID keys to be configured in the server environment
                  (VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY). Contact your administrator to set these
                  up.
                </ThemedText>
              </View>
            ) : isDenied ? (
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={COLORS.warning}
                  style={{ marginTop: 1 }}
                />
                <ThemedText style={{ fontSize: 13, color: mutedColor, flex: 1, lineHeight: 19 }}>
                  Push notifications are blocked by your browser. Open your browser&apos;s site
                  settings to allow notifications, then reload this page.
                </ThemedText>
              </View>
            ) : pushState === "unavailable" ? (
              <ThemedText style={{ fontSize: 13, color: mutedColor, lineHeight: 19 }}>
                Push notifications are not supported in this browser.
              </ThemedText>
            ) : (
              <View style={{ gap: 12 }}>
                <ThemedText style={{ fontSize: 13, color: mutedColor, lineHeight: 19 }}>
                  {isActive
                    ? "You will receive push notifications for new bookings, cancellations, and capacity alerts across all locations."
                    : "Enable push notifications to receive real-time alerts for new bookings, cancellations, and when a location is nearly full."}
                </ThemedText>

                {errorMsg && (
                  <ThemedText style={{ fontSize: 13, color: COLORS.error }}>{errorMsg}</ThemedText>
                )}

                <Pressable
                  onPress={isActive ? handleDisable : handleEnable}
                  disabled={working}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: BORDER_RADIUS.md,
                    borderWidth: 1,
                    borderColor: isActive ? COLORS.error : primaryColor,
                    backgroundColor: isActive
                      ? hexToRgba(COLORS.error, isDark ? 0.1 : 0.06)
                      : hexToRgba(primaryColor, isDark ? 0.12 : 0.08),
                    opacity: working ? 0.6 : 1,
                    alignSelf: "flex-start",
                  }}
                >
                  {working && (
                    <ActivityIndicator
                      size="small"
                      color={isActive ? COLORS.error : primaryColor}
                    />
                  )}
                  <ThemedText
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: isActive ? COLORS.error : primaryColor,
                    }}
                  >
                    {working
                      ? isActive
                        ? "Disabling…"
                        : "Enabling…"
                      : isActive
                        ? "Disable push notifications"
                        : "Enable push notifications"}
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </AnimatedAccordion>
    </View>
  );
}
