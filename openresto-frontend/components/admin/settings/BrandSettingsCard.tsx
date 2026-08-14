import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { theme } from "@/theme/theme";
import { saveBrandSettings, uploadHeroImage, deleteHeroImage } from "@/api/admin";
import { useBrand } from "@/context/BrandContext";
import { useAppTheme } from "@/hooks/use-app-theme";
import { FAVICON_ICONS, buildFaviconDataUri } from "@/constants/faviconIcons";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import {
  styles as settingsStyles,
  domStyles as settingsDomStyles,
  themedSelect,
} from "./settings.styles";
import { styles, domStyles } from "./BrandSettingsCard.styles";
import { Icon } from "@/components/common/Icon";

const MAX_HERO_MB = 5;

// Mirrors the backend ContactLimits caps.
const MAX_CONTACT_PHONE_LENGTH = 32;
const MAX_CONTACT_EMAIL_LENGTH = 254;

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
  const { primaryColor, colors } = useAppTheme();
  const [appName, setAppName] = useState(brand.appName);
  const [brandPrimaryColor, setBrandPrimaryColor] = useState(brand.primaryColor);
  const [faviconIcon, setFaviconIcon] = useState<string | undefined>(brand.faviconIcon);
  const [websiteUrl, setWebsiteUrl] = useState(brand.websiteUrl ?? "");
  const [phoneNumber, setPhoneNumber] = useState(brand.phoneNumber ?? "");
  const [emailAddress, setEmailAddress] = useState(brand.emailAddress ?? "");
  const [subtitle, setSubtitle] = useState(brand.subtitle ?? "");
  const [highlightsHeading, setHighlightsHeading] = useState(brand.highlightsHeading ?? "");
  const [highlightsSubheading, setHighlightsSubheading] = useState(
    brand.highlightsSubheading ?? ""
  );
  const [headerImageFit, setHeaderImageFit] = useState(brand.headerImageFit ?? "Cover");
  const [heroPreview, setHeroPreview] = useState<string | null>(brand.headerImageUrl ?? null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [expanded, setExpanded] = usePersistedState("settings:brand:expanded", true);

  const formIsDirty =
    appName !== brand.appName ||
    brandPrimaryColor !== brand.primaryColor ||
    faviconIcon !== brand.faviconIcon ||
    websiteUrl.trim() !== (brand.websiteUrl ?? "") ||
    phoneNumber.trim() !== (brand.phoneNumber ?? "") ||
    emailAddress.trim() !== (brand.emailAddress ?? "") ||
    subtitle.trim() !== (brand.subtitle ?? "") ||
    highlightsHeading.trim() !== (brand.highlightsHeading ?? "") ||
    highlightsSubheading.trim() !== (brand.highlightsSubheading ?? "") ||
    headerImageFit !== (brand.headerImageFit ?? "Cover") ||
    heroPreview !== (brand.headerImageUrl ?? null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAppName(brand.appName);
    setBrandPrimaryColor(brand.primaryColor);
    setFaviconIcon(brand.faviconIcon);
    setWebsiteUrl(brand.websiteUrl ?? "");
    setPhoneNumber(brand.phoneNumber ?? "");
    setEmailAddress(brand.emailAddress ?? "");
    setSubtitle(brand.subtitle ?? "");
    setHighlightsHeading(brand.highlightsHeading ?? "");
    setHighlightsSubheading(brand.highlightsSubheading ?? "");
    setHeaderImageFit(brand.headerImageFit ?? "Cover");
    setHeroPreview(brand.headerImageUrl ?? null);
  }, [brand]);

  /* istanbul ignore next */
  const handlePickHero = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_HERO_MB * 1024 * 1024) {
        setMsg({ text: `Image must be under ${MAX_HERO_MB} MB.`, ok: false });
        return;
      }
      setHeroUploading(true);
      setMsg(null);
      const url = await uploadHeroImage(file);
      setHeroUploading(false);
      if (url) {
        setHeroPreview(url);
        setMsg({ text: "Header image uploaded.", ok: true });
      } else {
        setMsg({ text: "Failed to upload image.", ok: false });
      }
    };
    input.click();
  };

  const handleDeleteHero = async () => {
    setHeroUploading(true);
    await deleteHeroImage();
    setHeroUploading(false);
    setHeroPreview(null);
    setMsg({ text: "Header image removed.", ok: true });
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    const result = await saveBrandSettings({
      appName,
      primaryColor: brandPrimaryColor,
      faviconIcon,
      websiteUrl: websiteUrl.trim() || undefined,
      phoneNumber: phoneNumber.trim(),
      emailAddress: emailAddress.trim(),
      subtitle: subtitle.trim() || "",
      highlightsHeading: highlightsHeading.trim() || "",
      highlightsSubheading: highlightsSubheading.trim() || "",
      headerImageFit,
    });
    setSaving(false);
    if (result) {
      setMsg({ text: result.message, ok: !result.message.toLowerCase().includes("fail") });
    } else {
      setMsg({ text: "Failed to save.", ok: false });
    }
  };

  const PRESET_COLORS = [
    "#0a7ea4",
    "#2563eb",
    "#7c3aed",
    "#059669",
    "#dc2626",
    "#d97706",
    "#475569",
  ];

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

          <View style={settingsStyles.field}>
            <ThemedText style={settingsStyles.fieldLabel}>Website URL</ThemedText>
            <Input
              value={websiteUrl}
              onChangeText={setWebsiteUrl}
              placeholder="https://bookings.example.com"
              autoCapitalize="none"
              keyboardType="url"
            />
            <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
              Used in confirmation email links and images. Must be the public URL of this app.
            </ThemedText>
          </View>

          <View style={settingsStyles.fieldRow}>
            <View style={[settingsStyles.field, settingsStyles.fieldFlex]}>
              <ThemedText style={settingsStyles.fieldLabel}>Contact Phone</ThemedText>
              <Input
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="+44 20 7946 0958"
                autoCapitalize="none"
                keyboardType="phone-pad"
                maxLength={MAX_CONTACT_PHONE_LENGTH}
              />
              <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
                Fallback contact shown when a location has no phone number of its own.
              </ThemedText>
            </View>

            <View style={[settingsStyles.field, settingsStyles.fieldFlex]}>
              <ThemedText style={settingsStyles.fieldLabel}>Contact Email</ThemedText>
              <Input
                value={emailAddress}
                onChangeText={setEmailAddress}
                placeholder="bookings@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                maxLength={MAX_CONTACT_EMAIL_LENGTH}
              />
              <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
                Fallback contact shown when a location has no email of its own.
              </ThemedText>
            </View>
          </View>

          <View style={settingsStyles.fieldRow}>
            <View style={[settingsStyles.field, settingsStyles.fieldFlex]}>
              <ThemedText style={settingsStyles.fieldLabel}>Highlights Heading</ThemedText>
              <Input
                value={highlightsHeading}
                onChangeText={setHighlightsHeading}
                placeholder="Restaurant highlights"
                maxLength={60}
              />
              <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
                Heading above the highlights section. Leave blank for the default.
              </ThemedText>
            </View>

            <View style={[settingsStyles.field, settingsStyles.fieldFlex]}>
              <ThemedText style={settingsStyles.fieldLabel}>Highlights Subheading</ThemedText>
              <Input
                value={highlightsSubheading}
                onChangeText={setHighlightsSubheading}
                placeholder="Curated by the owner"
                maxLength={60}
              />
            </View>
          </View>

          <View style={settingsStyles.field}>
            <ThemedText style={settingsStyles.fieldLabel}>
              Homepage Header Image (max {MAX_HERO_MB} MB)
            </ThemedText>
            <View style={styles.heroFitField}>
              <ThemedText style={settingsStyles.fieldLabel}>Image fit</ThemedText>
              <select
                data-testid="header-image-fit-select"
                value={headerImageFit}
                onChange={/* istanbul ignore next */ (e) => setHeaderImageFit(e.target.value)}
                style={{ ...settingsDomStyles.select, ...themedSelect(colors) }}
              >
                <option value="Cover">Cover (fill, may crop)</option>
                <option value="Contain">Contain (show whole image)</option>
              </select>
              <ThemedText style={[styles.heroFitHint, { color: mutedColor }]}>
                &quot;Contain&quot; avoids cropping on mobile; &quot;Cover&quot; fills the frame.
              </ThemedText>
            </View>
            <View style={styles.heroBlock}>
              {heroPreview ? (
                <View style={[styles.heroFrame, { borderColor }]}>
                  <img src={heroPreview} alt="Header" style={domStyles.heroImage} />
                </View>
              ) : (
                <View style={[styles.heroPlaceholder, { borderColor }]}>
                  <Icon name="image-outline" size="xxl" color={mutedColor} />
                  <ThemedText style={[styles.heroPlaceholderText, { color: mutedColor }]}>
                    No header image
                  </ThemedText>
                </View>
              )}
              <View style={styles.heroActions}>
                <Pressable
                  style={[settingsStyles.secBtn, { borderColor, opacity: heroUploading ? 0.5 : 1 }]}
                  onPress={handlePickHero}
                  disabled={heroUploading}
                  accessibilityRole="button"
                  accessibilityLabel={heroPreview ? "Change header image" : "Upload header image"}
                  accessibilityState={{ disabled: heroUploading, busy: heroUploading }}
                >
                  <ThemedText style={[settingsStyles.secBtnText, { color: primaryColor }]}>
                    {heroUploading ? "Uploading…" : heroPreview ? "Change" : "Upload"}
                  </ThemedText>
                </Pressable>
                {heroPreview && (
                  <Pressable
                    style={[
                      settingsStyles.secBtn,
                      { borderColor, opacity: heroUploading ? 0.5 : 1 },
                    ]}
                    onPress={handleDeleteHero}
                    disabled={heroUploading}
                    accessibilityRole="button"
                    accessibilityLabel="Remove header image"
                    accessibilityState={{ disabled: heroUploading }}
                  >
                    <ThemedText style={[settingsStyles.secBtnText, { color: theme.colors.error }]}>
                      Remove
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
          </View>

          {msg && (
            <ThemedText style={msg.ok ? settingsStyles.successText : settingsStyles.errorText}>
              {msg.text}
            </ThemedText>
          )}

          <Button
            onPress={handleSave}
            disabled={saving || !appName.trim() || formIsDirty === false}
            style={styles.saveBtn}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </View>
      </AnimatedAccordion>
    </View>
  );
}
