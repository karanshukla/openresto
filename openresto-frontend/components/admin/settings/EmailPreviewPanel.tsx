import React, { useEffect, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/common/Icon";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import Select from "@/components/common/Select";
import { getEmailPreview, type EmailPreviewDto } from "@/api/admin";
import { fetchRestaurants } from "@/api/restaurants";
import { useBrand } from "@/context/BrandContext";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { theme } from "@/theme/theme";
import type { EmailSettingsState } from "@/hooks/use-email-settings";
import { styles, frameStyle } from "./EmailPreviewPanel.styles";

interface LocationOption {
  id: number;
  name: string;
}

/**
 * The booking confirmation as a guest receives it, beside the settings that decide whether it is
 * sent at all.
 *
 * The body is rendered by the server through the same template the send path uses and dropped
 * into an iframe — deliberately not a React miniature of the email. A miniature would be a second
 * copy of the markup, and the copy that drifted would be the one nobody sees until it is in an
 * inbox. The envelope around it is where this screen's own unsaved state shows: the From line
 * follows the sender fields as they are typed, and the notice under it says when a preview is all
 * a guest would be getting.
 *
 * @see [EmailPreviewPanel.test.tsx](../../../tests/components/admin/settings/EmailPreviewPanel.test.tsx)
 *   — pins that the From line follows the unsaved fields and that confirmations being off is said
 *   out loud.
 */
export function EmailPreviewPanel({
  borderColor,
  mutedColor,
  cardBg,
  isDark,
  email,
}: {
  borderColor: string;
  mutedColor: string;
  cardBg: string;
  isDark: boolean;
  email: EmailSettingsState;
}) {
  const { t } = useTranslation();
  const { primaryColor } = useAppTheme();
  const brand = useBrand();
  const [expanded, setExpanded] = usePersistedState("settings:email:preview:expanded", true);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | undefined>(undefined);
  const [preview, setPreview] = useState<EmailPreviewDto | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchRestaurants().then((list) => setLocations(list.map((r) => ({ id: r.id, name: r.name }))));
  }, []);

  useEffect(() => {
    let stale = false;
    getEmailPreview(selectedId).then((result) => {
      if (stale) return;
      setPreview(result);
      setLoaded(true);
    });
    return () => {
      stale = true;
    };
  }, [selectedId]);

  const surface2 = isDark ? "#252729" : "#f9fafb";
  const warnColor = theme.colors.warning;
  const warnSoft = isDark ? `${warnColor}22` : "#fffbeb";

  const senderName = email.fromName.trim() || brand.appName;
  const senderAddress = email.fromEmail.trim();

  // The two ways a guest ends up with nothing, in the order an admin fixes them.
  const blockedNotice = !email.isConfigured
    ? t("admin.settings.emailPreview.notConfigured")
    : !email.sendConfirmations
      ? t("admin.settings.emailPreview.confirmationsOff")
      : null;

  const row = (label: string, value: string, first: boolean, strong = false) => (
    <View
      style={[
        styles.envelopeRow,
        !first && styles.envelopeRowDivider,
        { borderTopColor: borderColor },
      ]}
    >
      <ThemedText style={[styles.envelopeLabel, { color: mutedColor }]}>{label}</ThemedText>
      <ThemedText style={[styles.envelopeValue, strong && styles.envelopeSubject]}>
        {value}
      </ThemedText>
    </View>
  );

  return (
    <View style={[styles.panel, { backgroundColor: cardBg, borderColor }]}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: `${primaryColor}18` }]}>
          <Icon name="mail-outline" size="xl" color={primaryColor} />
        </View>
        <View style={styles.headerCopy}>
          <ThemedText style={styles.headerTitle}>
            {t("admin.settings.emailPreview.title")}
          </ThemedText>
          <ThemedText style={[styles.headerSub, { color: mutedColor }]}>
            {t("admin.settings.emailPreview.subtitle")}
          </ThemedText>
        </View>
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={t("admin.settings.emailPreview.title")}
          accessibilityState={{ expanded }}
          hitSlop={8}
        >
          <Icon name={expanded ? "chevron-up" : "chevron-down"} size="lg" color={mutedColor} />
        </Pressable>
      </View>

      <AnimatedAccordion expanded={expanded}>
        <View style={[styles.body, { borderTopColor: borderColor }]}>
          {locations.length > 1 && (
            <Select
              options={locations.map((l) => ({ label: l.name, value: l.id }))}
              selectedValue={preview?.restaurantId ?? undefined}
              onSelect={(value) => setSelectedId(Number(value))}
              accessibilityLabel={t("admin.settings.emailPreview.locationLabel")}
            />
          )}

          {blockedNotice && (
            <View
              style={[styles.note, { backgroundColor: warnSoft, borderColor: `${warnColor}50` }]}
            >
              <Icon name="alert-circle-outline" size="md" color={warnColor} />
              <ThemedText style={[styles.noteText, { color: warnColor }]}>
                {blockedNotice}
              </ThemedText>
            </View>
          )}

          {preview ? (
            <View
              testID="email-preview-envelope"
              style={[styles.envelope, { borderColor, backgroundColor: surface2 }]}
            >
              {row(
                t("admin.settings.emailPreview.from"),
                senderAddress
                  ? `${senderName} <${senderAddress}>`
                  : t("admin.settings.emailPreview.senderNotSet", { name: senderName }),
                true
              )}
              {row(t("admin.settings.emailPreview.to"), preview.recipientEmail, false)}
              {row(t("admin.settings.emailPreview.subject"), preview.subject, false, true)}

              {Platform.OS === "web" && (
                <View style={[styles.frame, { borderTopColor: borderColor }]}>
                  {React.createElement("iframe", {
                    // A DOM element, so it takes the DOM attribute: React warns on `testID`
                    // here, which react-native-web only maps for components it renders itself.
                    "data-testid": "email-preview-frame",
                    title: t("admin.settings.emailPreview.frameTitle"),
                    srcDoc: preview.html,
                    // No scripts, no same-origin: the body is HTML the server composed from
                    // brand and location fields an admin can edit, so it renders sealed off
                    // from the admin session it is being viewed inside.
                    sandbox: "",
                    style: frameStyle,
                  })}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.loading}>
              <ThemedText style={[styles.hint, { color: mutedColor }]}>
                {loaded
                  ? t("admin.settings.emailPreview.unavailable")
                  : t("admin.settings.emailPreview.loading")}
              </ThemedText>
            </View>
          )}

          <ThemedText style={[styles.hint, { color: mutedColor }]}>
            {t("admin.settings.emailPreview.hint")}
          </ThemedText>
        </View>
      </AnimatedAccordion>
    </View>
  );
}
