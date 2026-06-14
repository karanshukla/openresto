import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/theme/theme";
import { saveBrandSettings, uploadHeroImage, deleteHeroImage } from "@/api/admin";
import { useBrand } from "@/context/BrandContext";
import { FAVICON_ICONS, buildFaviconDataUri } from "@/constants/faviconIcons";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { styles } from "./settings.styles";

const MAX_HERO_MB = 5;

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
  const primaryColor = brand.primaryColor || COLORS.primary;
  const [appName, setAppName] = useState(brand.appName);
  const [brandPrimaryColor, setBrandPrimaryColor] = useState(brand.primaryColor);
  const [faviconIcon, setFaviconIcon] = useState<string | undefined>(brand.faviconIcon);
  const [heroPreview, setHeroPreview] = useState<string | null>(brand.headerImageUrl ?? null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [expanded, setExpanded] = usePersistedState("settings:brand:expanded", true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAppName(brand.appName);
    setBrandPrimaryColor(brand.primaryColor);
    setFaviconIcon(brand.faviconIcon);
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
    <View style={[styles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <Pressable style={styles.secHeader} onPress={() => setExpanded((v) => !v)}>
        <View style={[styles.secIcon, { backgroundColor: `${primaryColor}20` }]}>
          <Ionicons name="brush-outline" size={20} color={primaryColor} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.secTitle}>Brand Identity</ThemedText>
          <ThemedText style={[styles.secSub, { color: mutedColor }]} numberOfLines={1}>
            {appName} · {brandPrimaryColor}
            {faviconIcon
              ? ` · ${FAVICON_ICONS.find((i) => i.id === faviconIcon)?.label ?? faviconIcon}`
              : ""}
          </ThemedText>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={mutedColor} />
      </Pressable>

      <AnimatedAccordion expanded={expanded}>
        <View style={[styles.secForm, { borderTopColor: borderColor }]}>
          <View style={styles.field}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <ThemedText style={styles.fieldLabel}>App Name</ThemedText>
              <ThemedText
                style={{ fontSize: 11, color: appName.length > 32 ? COLORS.error : mutedColor }}
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

          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>Primary Color</ThemedText>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {PRESET_COLORS.map((c) => (
                <Pressable
                  key={c}
                  testID={`color-swatch-${c}`}
                  onPress={() => setBrandPrimaryColor(c)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: c,
                    borderWidth: brandPrimaryColor === c ? 3 : 0,
                    borderColor: "#fff",
                    shadowColor: "#000",
                    shadowOpacity: brandPrimaryColor === c ? 0.3 : 0,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 2 },
                  }}
                />
              ))}
              <Input
                value={brandPrimaryColor}
                onChangeText={setBrandPrimaryColor}
                placeholder="#0a7ea4"
                style={{ width: 100 }}
              />
            </View>
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>Favicon Icon</ThemedText>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {FAVICON_ICONS.map((icon) => {
                const isSelected = faviconIcon === icon.id;
                const dataUri = buildFaviconDataUri(icon.id, brandPrimaryColor);
                return (
                  <Pressable
                    key={icon.id}
                    testID={`favicon-icon-${icon.id}`}
                    onPress={() => setFaviconIcon(isSelected ? undefined : icon.id)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? brandPrimaryColor : `${brandPrimaryColor}40`,
                      backgroundColor: isSelected ? `${brandPrimaryColor}18` : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    accessibilityLabel={icon.label}
                  >
                    <img src={dataUri} alt={icon.label} style={{ width: 22, height: 22 }} />
                  </Pressable>
                );
              })}
            </View>
            {faviconIcon && (
              <ThemedText style={{ fontSize: 11, color: mutedColor, marginTop: 4 }}>
                {FAVICON_ICONS.find((i) => i.id === faviconIcon)?.label} · tap to deselect
              </ThemedText>
            )}
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>
              Homepage Header Image (max {MAX_HERO_MB} MB)
            </ThemedText>
            <View style={{ gap: 8 }}>
              {heroPreview ? (
                <View
                  style={{
                    width: "100%",
                    aspectRatio: 16 / 5,
                    borderRadius: 8,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor,
                  }}
                >
                  <img
                    src={heroPreview}
                    alt="Header"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </View>
              ) : (
                <View
                  style={{
                    width: "100%",
                    aspectRatio: 16 / 5,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderStyle: "dashed" as const,
                    borderColor,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Ionicons name="image-outline" size={24} color={mutedColor} />
                  <ThemedText style={{ fontSize: 12, color: mutedColor }}>
                    No header image
                  </ThemedText>
                </View>
              )}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  style={[styles.secBtn, { borderColor, opacity: heroUploading ? 0.5 : 1 }]}
                  onPress={handlePickHero}
                  disabled={heroUploading}
                >
                  <ThemedText style={[styles.secBtnText, { color: primaryColor }]}>
                    {heroUploading ? "Uploading…" : heroPreview ? "Change" : "Upload"}
                  </ThemedText>
                </Pressable>
                {heroPreview && (
                  <Pressable
                    style={[styles.secBtn, { borderColor, opacity: heroUploading ? 0.5 : 1 }]}
                    onPress={handleDeleteHero}
                    disabled={heroUploading}
                  >
                    <ThemedText style={[styles.secBtnText, { color: COLORS.error }]}>
                      Remove
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
          </View>

          {msg && (
            <ThemedText style={msg.ok ? styles.successText : styles.errorText}>
              {msg.text}
            </ThemedText>
          )}

          <Button
            onPress={handleSave}
            disabled={saving || !appName.trim()}
            style={{ marginTop: 4 }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </View>
      </AnimatedAccordion>
    </View>
  );
}
