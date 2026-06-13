import { useState, useEffect } from "react";
import { View, Pressable, Platform, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";
import { getVapidPublicKey, subscribePush, unsubscribePush } from "@/api/notifications";
import { styles } from "./settings.styles";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0))) as Uint8Array<ArrayBuffer>;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

type PushState = "loading" | "unavailable" | "denied" | "active" | "inactive";

export function PushNotificationsCard({
  restaurantId,
  borderColor,
  mutedColor,
  cardBg,
}: {
  restaurantId: number | null;
  borderColor: string;
  mutedColor: string;
  cardBg: string;
}) {
  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;

  const [expanded, setExpanded] = useState(false);
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
      setVapidKey(key);
      if (key == null) {
        setPushState("unavailable");
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

  // Don't render card if VAPID not configured or non-web
  if (vapidKey === undefined) return null;
  if (vapidKey === null && pushState === "unavailable" && Platform.OS !== "web") return null;
  if (vapidKey === null) return null;

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
      await subscribePush(restaurantId ?? 0, {
        endpoint: sub.endpoint,
        p256dh: arrayBufferToBase64(p256dhBuffer),
        auth: arrayBufferToBase64(authBuffer),
      });
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

  const stateIcon =
    pushState === "active"
      ? "notifications-outline"
      : pushState === "denied"
        ? "notifications-off-outline"
        : "notifications-outline";

  const stateSub =
    pushState === "loading"
      ? "Checking status…"
      : pushState === "active"
        ? "Push notifications active for this location"
        : pushState === "denied"
          ? "Notifications blocked — enable in browser settings"
          : pushState === "unavailable"
            ? "Not supported in this browser"
            : "Click to enable push notifications";

  return (
    <View style={[styles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <Pressable style={styles.secHeader} onPress={() => setExpanded((v) => !v)}>
        <View
          style={[
            styles.secIcon,
            {
              backgroundColor: pushState === "active" ? `${COLORS.success}18` : `${primaryColor}18`,
            },
          ]}
        >
          <Ionicons
            name={stateIcon}
            size={20}
            color={pushState === "active" ? COLORS.success : primaryColor}
          />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.secTitle}>Push Notifications</ThemedText>
          <ThemedText style={[styles.secSub, { color: mutedColor }]}>{stateSub}</ThemedText>
        </View>
        {pushState === "loading" ? (
          <ActivityIndicator size="small" color={primaryColor} />
        ) : (
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={mutedColor} />
        )}
      </Pressable>

      {expanded && pushState !== "loading" && pushState !== "unavailable" && (
        <View style={[styles.secForm, { borderTopColor: borderColor }]}>
          {pushState === "denied" ? (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={mutedColor}
                style={{ marginTop: 1 }}
              />
              <ThemedText style={{ fontSize: 13, color: mutedColor, flex: 1, lineHeight: 19 }}>
                Push notifications are blocked by your browser. Open your browser&apos;s site
                settings to allow notifications, then reload this page.
              </ThemedText>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <ThemedText style={{ fontSize: 13, color: mutedColor, lineHeight: 19 }}>
                {pushState === "active"
                  ? "You will receive push notifications for new bookings, cancellations, and capacity alerts for this location."
                  : "Enable push notifications to receive real-time alerts for new bookings, cancellations, and when a location is nearly full."}
              </ThemedText>

              {errorMsg && (
                <ThemedText style={{ fontSize: 13, color: COLORS.error }}>{errorMsg}</ThemedText>
              )}

              <Pressable
                onPress={pushState === "active" ? handleDisable : handleEnable}
                disabled={working}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: pushState === "active" ? COLORS.error : primaryColor,
                  backgroundColor:
                    pushState === "active" ? "rgba(220,38,38,0.06)" : `${primaryColor}10`,
                  opacity: working ? 0.6 : 1,
                  alignSelf: "flex-start",
                }}
              >
                {working && (
                  <ActivityIndicator
                    size="small"
                    color={pushState === "active" ? COLORS.error : primaryColor}
                  />
                )}
                <ThemedText
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: pushState === "active" ? COLORS.error : primaryColor,
                  }}
                >
                  {working
                    ? pushState === "active"
                      ? "Disabling…"
                      : "Enabling…"
                    : pushState === "active"
                      ? "Disable push notifications"
                      : "Enable push notifications"}
                </ThemedText>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
