import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/theme/theme";
import { hexToRgba } from "@/utils/colors";
import { getVapidPublicKey, subscribePush } from "@/api/notifications";
import { arrayBufferToBase64, urlBase64ToUint8Array } from "@/utils/notifications";
import { styles } from "@/components/admin/notifications/notifications.styles";

type PushStatus = "unknown" | "active" | "inactive" | "denied" | "unsupported";

function usePushStatus(vapidKey: string | null | undefined) {
  const [status, setStatus] = useState<PushStatus>("unknown");

  useEffect(() => {
    if (Platform.OS !== "web" || vapidKey === undefined) return;
    if (vapidKey === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("unsupported");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    navigator.serviceWorker.ready.then(async (sw) => {
      const existing = await sw.pushManager.getSubscription();
      setStatus(existing ? "active" : "inactive");
    });
  }, [vapidKey]);

  return [status, setStatus] as const;
}

export interface PushBannerProps {
  restaurantId: number | null;
  primaryColor: string;
  isDark: boolean;
}

/**
 * Web-only push-notification opt-in banner.
 *
 * Fetches the VAPID public key, checks the current subscription/permission
 * state, and — if push is available but not yet active — shows a banner with an
 * Enable button that subscribes the service worker. Renders nothing on native
 * or when push is unsupported/already active.
 *
 * Extracted from the notifications screen for decomposition; self-contained
 * (owns its fetch + subscription state).
 */
export function PushBanner({ restaurantId, primaryColor, isDark }: PushBannerProps) {
  const [vapidKey, setVapidKey] = useState<string | null | undefined>(undefined);
  const [pushStatus, setPushStatus] = usePushStatus(vapidKey);
  const [working, setWorking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    getVapidPublicKey().then(setVapidKey);
  }, []);

  if (Platform.OS !== "web") return null;
  if (vapidKey === undefined) return null;
  if (pushStatus === "unsupported" || pushStatus === "active" || pushStatus === "unknown")
    return null;

  const handleEnable = async () => {
    if (!vapidKey) return;
    setWorking(true);
    setErrorMsg(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setPushStatus("denied");
        setErrorMsg("Blocked by browser — allow notifications in site settings.");
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
      await subscribePush(restaurantId ?? 0, {
        endpoint: sub.endpoint,
        p256dh: arrayBufferToBase64(p256dhBuffer),
        auth: arrayBufferToBase64(authBuffer),
      });
      setPushStatus("active");
    } catch (err) {
      console.error("Push subscribe error:", err);
      setErrorMsg("Failed to enable — try again.");
    }
    setWorking(false);
  };

  if (pushStatus === "denied") {
    return (
      <View
        style={[
          styles.pushBanner,
          {
            borderColor: isDark ? "rgba(245,158,11,0.3)" : "rgba(245,158,11,0.25)",
            backgroundColor: isDark ? "rgba(245,158,11,0.07)" : "rgba(245,158,11,0.04)",
          },
        ]}
      >
        <Ionicons name="notifications-off-outline" size={16} color={theme.colors.warning} />
        <ThemedText style={[styles.pushBannerText, { color: theme.colors.warning }]}>
          Push notifications blocked — enable in browser site settings.
        </ThemedText>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.pushBanner,
        {
          borderColor: isDark ? hexToRgba(primaryColor, 0.25) : hexToRgba(primaryColor, 0.2),
          backgroundColor: isDark ? hexToRgba(primaryColor, 0.07) : hexToRgba(primaryColor, 0.04),
        },
      ]}
    >
      <Ionicons name="notifications-outline" size={16} color={primaryColor} />
      <ThemedText style={[styles.pushBannerText, { color: primaryColor }]}>
        Enable push notifications to get real-time booking alerts.
      </ThemedText>
      {errorMsg && (
        <ThemedText style={[styles.pushBannerText, { color: theme.colors.error, flex: undefined }]}>
          {errorMsg}
        </ThemedText>
      )}
      <Pressable
        onPress={handleEnable}
        disabled={working}
        style={[
          styles.pushBannerBtn,
          { backgroundColor: primaryColor, opacity: working ? 0.7 : 1 },
        ]}
      >
        {working ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <ThemedText style={styles.pushBannerBtnText}>Enable</ThemedText>
        )}
      </Pressable>
    </View>
  );
}
