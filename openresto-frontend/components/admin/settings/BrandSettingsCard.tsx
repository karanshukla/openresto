import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import { theme } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAutosave } from "@/hooks/use-autosave";
import { FAVICON_ICONS, buildFaviconDataUri } from "@/constants/faviconIcons";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { styles as settingsStyles } from "./settings.styles";
import { styles, domStyles } from "./BrandSettingsCard.styles";
import { useBrandDraftPublish } from "./BrandDraftContext";
import { saveBrandFields } from "./brandAutosave";
import { SaveStatus } from "./SaveStatus";
import { Icon } from "@/components/common/Icon";

const PRESET_COLORS = ["#0a7ea4", "#2563eb", "#7c3aed", "#059669", "#dc2626", "#d97706", "#475569"];

/** Mirrors BrandService.IsValidHexColor — a half-typed colour must not be autosaved. */
const HEX_COLOR = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

/**
 * Who the site says it is: the name, the tagline under it, the colour every accent is derived
 * from, and the tab icon. The header image, contact details and highlight copy each have a card
 * of their own — this one is the four fields the preview's chrome and hero are made of.
 */
export function BrandSettingsCard({
  borderColor,
  mutedColor,
  cardBg,
}: {
  borderColor: string;
  mutedColor: string;
  cardBg: string;
}) {
  const brand = useBrand();
  const { primaryColor } = useAppTheme();
  const [appName, setAppName] = useState(brand.appName);
  const [brandPrimaryColor, setBrandPrimaryColor] = useState(brand.primaryColor);
  const [faviconIcon, setFaviconIcon] = useState<string | undefined>(brand.faviconIcon);
  const [subtitle, setSubtitle] = useState(brand.subtitle ?? "");
  const [expanded, setExpanded] = usePersistedState("settings:brand:expanded", true);

  useBrandDraftPublish({
    appName,
    primaryColor: brandPrimaryColor,
    faviconIcon,
    subtitle,
  });

  // A withheld save has to say why: with no button to disable, silence reads as a broken card.
  const blockedReason = !appName.trim()
    ? "Not saved: the app name can't be empty."
    : !HEX_COLOR.test(brandPrimaryColor)
      ? "Not saved: waiting for a full hex colour, like #0a7ea4."
      : null;

  const { status, error, retry } = useAutosave({
    values: {
      appName,
      primaryColor: brandPrimaryColor,
      // An omitted field means "leave it alone" to the API, so deselecting an icon has to send
      // an explicit empty string for the server to clear it.
      faviconIcon: faviconIcon ?? "",
      subtitle: subtitle.trim(),
    },
    saved: {
      appName: brand.appName,
      primaryColor: brand.primaryColor,
      faviconIcon: brand.faviconIcon ?? "",
      subtitle: brand.subtitle ?? "",
    },
    save: saveBrandFields,
    canSave: !blockedReason,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAppName(brand.appName);
    setBrandPrimaryColor(brand.primaryColor);
    setFaviconIcon(brand.faviconIcon);
    setSubtitle(brand.subtitle ?? "");
  }, [brand]);

  return (
    <View style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <Pressable
        style={settingsStyles.secHeader}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="Brand Identity"
        accessibilityState={{ expanded }}
      >
        <View style={[settingsStyles.secIcon, { backgroundColor: `${primaryColor}20` }]}>
          <Icon name="brush-outline" size="xl" color={primaryColor} />
        </View>
        <View style={settingsStyles.secHeaderCopy}>
          <ThemedText style={settingsStyles.secTitle}>Brand Identity</ThemedText>
          <ThemedText style={[settingsStyles.secSub, { color: mutedColor }]} numberOfLines={1}>
            {appName} · {brandPrimaryColor}
            {faviconIcon
              ? ` · ${FAVICON_ICONS.find((i) => i.id === faviconIcon)?.label ?? faviconIcon}`
              : ""}
          </ThemedText>
        </View>
        <Icon name={expanded ? "chevron-up" : "chevron-down"} size="lg" color={mutedColor} />
      </Pressable>

      <AnimatedAccordion expanded={expanded}>
        <View style={[settingsStyles.secForm, { borderTopColor: borderColor }]}>
          <View style={settingsStyles.field}>
            <View style={settingsStyles.fieldHeader}>
              <ThemedText style={settingsStyles.fieldLabel}>App Name</ThemedText>
              <ThemedText
                style={[
                  settingsStyles.fieldCharCount,
                  { color: appName.length > 32 ? theme.colors.error : mutedColor },
                ]}
              >
                {appName.length}/32
              </ThemedText>
            </View>
            <Input
              value={appName}
              onChangeText={setAppName}
              placeholder="Open Resto"
              maxLength={32}
            />
          </View>

          <View style={settingsStyles.field}>
            <View style={settingsStyles.fieldHeader}>
              <ThemedText style={settingsStyles.fieldLabel}>Home Page Subtitle</ThemedText>
              <ThemedText
                style={[
                  settingsStyles.fieldCharCount,
                  { color: subtitle.length > 160 ? theme.colors.error : mutedColor },
                ]}
              >
                {subtitle.length}/160
              </ThemedText>
            </View>
            <Input
              value={subtitle}
              onChangeText={setSubtitle}
              placeholder="Scroll down to pick a location below…"
              maxLength={160}
            />
            <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
              Tagline shown under the app name. Leave blank for the default text.
            </ThemedText>
          </View>

          <View style={settingsStyles.field}>
            <ThemedText style={settingsStyles.fieldLabel}>Primary Color</ThemedText>
            <View style={styles.swatchRow}>
              {PRESET_COLORS.map((c) => (
                <Pressable
                  key={c}
                  testID={`color-swatch-${c}`}
                  onPress={() => setBrandPrimaryColor(c)}
                  accessibilityRole="radio"
                  accessibilityLabel={`Primary color ${c}`}
                  accessibilityState={{ checked: brandPrimaryColor === c }}
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: c,
                      borderWidth: brandPrimaryColor === c ? 3 : 0,
                      shadowOpacity: brandPrimaryColor === c ? 0.3 : 0,
                    },
                  ]}
                />
              ))}
              <Input
                value={brandPrimaryColor}
                onChangeText={setBrandPrimaryColor}
                placeholder="#0a7ea4"
                style={styles.hexInput}
              />
            </View>
          </View>

          <View style={settingsStyles.field}>
            <ThemedText style={settingsStyles.fieldLabel}>Favicon Icon</ThemedText>
            <View style={styles.faviconGrid}>
              {FAVICON_ICONS.map((icon) => {
                const isSelected = faviconIcon === icon.id;
                const dataUri = buildFaviconDataUri(icon.id, brandPrimaryColor);
                return (
                  <Pressable
                    key={icon.id}
                    testID={`favicon-icon-${icon.id}`}
                    onPress={() => setFaviconIcon(isSelected ? undefined : icon.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    style={[
                      styles.faviconSwatch,
                      {
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected ? brandPrimaryColor : `${brandPrimaryColor}40`,
                        backgroundColor: isSelected ? `${brandPrimaryColor}18` : "transparent",
                      },
                    ]}
                    accessibilityLabel={icon.label}
                  >
                    <img src={dataUri} alt={icon.label} style={domStyles.faviconImage} />
                  </Pressable>
                );
              })}
            </View>
            {faviconIcon && (
              <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
                {FAVICON_ICONS.find((i) => i.id === faviconIcon)?.label} · tap to deselect
              </ThemedText>
            )}
          </View>

          <SaveStatus
            status={status}
            error={error}
            onRetry={retry}
            mutedColor={mutedColor}
            blockedReason={blockedReason}
            testID="brand-identity-save-status"
          />
        </View>
      </AnimatedAccordion>
    </View>
  );
}
