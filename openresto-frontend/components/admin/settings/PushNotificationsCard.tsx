import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View, Platform, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { getVapidPublicKey, subscribePush, unsubscribePush } from "@/api/notifications";
import { fetchRestaurants } from "@/api/restaurants";
import Button from "@/components/common/Button";
import { ButtonRow } from "@/components/common/ButtonRow";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { styles as settingsStyles } from "./settings.styles";
import { AccordionCardHeader } from "./AccordionCardHeader";
import { styles } from "./PushNotificationsCard.styles";
import { Icon } from "@/components/common/Icon";

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
  const { t } = useTranslation();
  const { colors, primaryColor } = useAppTheme();
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
        setErrorMsg(t("admin.settings.pushNotifications.blockedError"));
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

      const restaurants = await fetchRestaurants();
      await Promise.all(restaurants.map((r) => subscribePush(r.id, payload)));

      setPushState("active");
    } catch (err) {
      console.error("Push subscribe error:", err);
      setErrorMsg(t("admin.settings.pushNotifications.enableFailed"));
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
      setErrorMsg(t("admin.settings.pushNotifications.disableFailed"));
    }
    setWorking(false);
  };

  const isActive = pushState === "active";
  const isDenied = pushState === "denied";
  const isUnconfigured = pushState === "unconfigured";

  const iconColor = isDenied || isUnconfigured ? theme.colors.warning : primaryColor;
  const stateIcon: "notifications-outline" | "notifications-off-outline" = isDenied
    ? "notifications-off-outline"
    : "notifications-outline";

  const stateSub =
    pushState === "loading"
      ? t("admin.settings.pushNotifications.checkingStatus")
      : isActive
        ? t("admin.settings.pushNotifications.activeSubtitle")
        : isDenied
          ? t("admin.settings.pushNotifications.deniedSubtitle")
          : isUnconfigured
            ? t("admin.settings.pushNotifications.unconfiguredSubtitle")
            : pushState === "unavailable"
              ? t("admin.settings.pushNotifications.unavailableSubtitle")
              : t("admin.settings.pushNotifications.inactiveSubtitle");

  return (
    <View style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <AccordionCardHeader
        icon={stateIcon}
        iconColor={iconColor}
        title={t("admin.settings.pushNotifications.title")}
        subtitle={stateSub}
        subtitleColor={isUnconfigured || isDenied ? theme.colors.warning : undefined}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        primaryColor={primaryColor}
        mutedColor={mutedColor}
        trailing={
          pushState === "loading" ? (
            <ActivityIndicator size="small" color={primaryColor} />
          ) : undefined
        }
      />

      <AnimatedAccordion expanded={expanded}>
        {pushState !== "loading" && (
          <View style={[settingsStyles.secForm, { borderTopColor: borderColor }]}>
            {isUnconfigured ? (
              <View style={styles.notice}>
                <Icon
                  name="warning-outline"
                  size="md"
                  color={theme.colors.warning}
                  style={styles.noticeIcon}
                />
                <ThemedText style={[styles.noticeText, { color: mutedColor }]}>
                  {t("admin.settings.pushNotifications.unconfiguredNotice")}
                </ThemedText>
              </View>
            ) : isDenied ? (
              <View style={styles.notice}>
                <Icon
                  name="information-circle-outline"
                  size="md"
                  color={theme.colors.warning}
                  style={styles.noticeIcon}
                />
                <ThemedText style={[styles.noticeText, { color: mutedColor }]}>
                  {t("admin.settings.pushNotifications.deniedNotice")}
                </ThemedText>
              </View>
            ) : pushState === "unavailable" ? (
              <ThemedText style={[styles.bodyText, { color: mutedColor }]}>
                {t("admin.settings.pushNotifications.unavailableBody")}
              </ThemedText>
            ) : (
              <View style={styles.body}>
                <ThemedText style={[styles.bodyText, { color: mutedColor }]}>
                  {isActive
                    ? t("admin.settings.pushNotifications.activeBody")
                    : t("admin.settings.pushNotifications.inactiveBody")}
                </ThemedText>

                {errorMsg && <ThemedText style={styles.error}>{errorMsg}</ThemedText>}

                <ButtonRow align="start">
                  <Button
                    variant="secondary"
                    tone={isActive ? "danger" : "brand"}
                    size="md"
                    icon={isActive ? "notifications-off-outline" : "notifications-outline"}
                    onPress={isActive ? handleDisable : handleEnable}
                    disabled={working}
                    loading={working}
                    accessibilityLabel={
                      isActive
                        ? t("admin.settings.pushNotifications.disableButton")
                        : t("admin.settings.pushNotifications.enableButton")
                    }
                  >
                    {working
                      ? isActive
                        ? t("admin.settings.pushNotifications.disabling")
                        : t("admin.settings.pushNotifications.enabling")
                      : isActive
                        ? t("admin.settings.pushNotifications.disableButton")
                        : t("admin.settings.pushNotifications.enableButton")}
                  </Button>
                </ButtonRow>
              </View>
            )}
          </View>
        )}
      </AnimatedAccordion>
    </View>
  );
}
