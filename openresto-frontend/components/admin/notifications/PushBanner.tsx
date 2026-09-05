import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { theme } from "@/theme/theme";
import { hexToRgba } from "@/utils/colors";
import { getVapidPublicKey, subscribePush } from "@/api/notifications";
import { arrayBufferToBase64, urlBase64ToUint8Array } from "@/utils/notifications";
import { styles } from "@/components/admin/notifications/notifications.styles";
import { Icon } from "@/components/common/Icon";

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
 * Deliberately unaware of the page's selected location: the subscription it registers
 * covers every one of them. Scoping it to whatever the admin happened to be filtering by
 * is what left bookings at the other locations with no subscriber to send to.
 */
export function PushBanner({ primaryColor, isDark }: PushBannerProps) {
  const { t } = useTranslation();
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
        setErrorMsg(t("admin.notifications.pushBanner.blockedError"));
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
      await subscribePush({
        endpoint: sub.endpoint,
        p256dh: arrayBufferToBase64(p256dhBuffer),
        auth: arrayBufferToBase64(authBuffer),
      });
      setPushStatus("active");
    } catch (err) {
      console.error("Push subscribe error:", err);
      setErrorMsg(t("admin.notifications.pushBanner.enableFailed"));
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
        <Icon name="notifications-off-outline" size="md" color={theme.colors.warning} />
        <ThemedText style={[styles.pushBannerText, { color: theme.colors.warning }]}>
          {t("admin.notifications.pushBanner.deniedBanner")}
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
      <Icon name="notifications-outline" size="md" color={primaryColor} />
      <ThemedText style={[styles.pushBannerText, { color: primaryColor }]}>
        {t("admin.notifications.pushBanner.promptBanner")}
      </ThemedText>
      {errorMsg && (
        <ThemedText
          role="alert"
          accessibilityLiveRegion="assertive"
          style={[styles.pushBannerText, { color: theme.colors.error, flex: undefined }]}
        >
          {errorMsg}
        </ThemedText>
      )}
      <Button
        size="md"
        icon="notifications-outline"
        onPress={handleEnable}
        disabled={working}
        loading={working}
        accessibilityLabel={t("admin.notifications.pushBanner.enableLabel")}
      >
        {t("admin.notifications.pushBanner.enable")}
      </Button>
    </View>
  );
}
