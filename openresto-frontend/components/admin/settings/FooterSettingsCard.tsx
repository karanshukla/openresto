import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING } from "@/theme/theme";
import { saveBrandSettings, SocialLinksDto } from "@/api/admin";
import { useBrand } from "@/context/BrandContext";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { styles } from "./settings.styles";

const SOCIAL_FIELDS: {
  key: keyof SocialLinksDto;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  placeholder: string;
}[] = [
  {
    key: "instagram",
    icon: "logo-instagram",
    label: "Instagram",
    placeholder: "https://instagram.com/yourresto",
  },
  {
    key: "facebook",
    icon: "logo-facebook",
    label: "Facebook",
    placeholder: "https://facebook.com/yourresto",
  },
  { key: "twitter", icon: "logo-x", label: "X (Twitter)", placeholder: "https://x.com/yourresto" },
  {
    key: "tiktok",
    icon: "logo-tiktok",
    label: "TikTok",
    placeholder: "https://tiktok.com/@yourresto",
  },
  {
    key: "youtube",
    icon: "logo-youtube",
    label: "YouTube",
    placeholder: "https://youtube.com/@yourresto",
  },
];

const emptySocialLinks: SocialLinksDto = {
  instagram: "",
  facebook: "",
  twitter: "",
  tiktok: "",
  youtube: "",
};

export function FooterSettingsCard({
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
  const [copyrightText, setCopyrightText] = useState(brand.copyrightText ?? "");
  const [socialLinks, setSocialLinks] = useState<SocialLinksDto>({
    ...emptySocialLinks,
    ...brand.socialLinks,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [expanded, setExpanded] = usePersistedState("settings:footer:expanded", false);

  const savedSocialLinks: SocialLinksDto = { ...emptySocialLinks, ...brand.socialLinks };
  const formIsDirty =
    copyrightText.trim() !== (brand.copyrightText ?? "") ||
    SOCIAL_FIELDS.some(
      (f) => (socialLinks[f.key] ?? "").trim() !== (savedSocialLinks[f.key] ?? "")
    );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCopyrightText(brand.copyrightText ?? "");
    setSocialLinks({ ...emptySocialLinks, ...brand.socialLinks });
  }, [brand]);

  const configuredCount = SOCIAL_FIELDS.filter((f) => brand.socialLinks?.[f.key]).length;

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    const result = await saveBrandSettings({
      copyrightText: copyrightText.trim(),
      socialLinks: {
        instagram: socialLinks.instagram?.trim() ?? "",
        facebook: socialLinks.facebook?.trim() ?? "",
        twitter: socialLinks.twitter?.trim() ?? "",
        tiktok: socialLinks.tiktok?.trim() ?? "",
        youtube: socialLinks.youtube?.trim() ?? "",
      },
    });
    setSaving(false);
    if (result) {
      setMsg({ text: result.message, ok: !result.message.toLowerCase().includes("fail") });
    } else {
      setMsg({ text: "Failed to save.", ok: false });
    }
  };

  return (
    <View style={[styles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <Pressable style={styles.secHeader} onPress={() => setExpanded((v) => !v)}>
        <View style={[styles.secIcon, { backgroundColor: `${primaryColor}20` }]}>
          <Ionicons name="link-outline" size={20} color={primaryColor} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.secTitle}>Footer</ThemedText>
          <ThemedText style={[styles.secSub, { color: mutedColor }]} numberOfLines={1}>
            {configuredCount > 0
              ? `${configuredCount} social link${configuredCount === 1 ? "" : "s"} configured`
              : "Copyright text and social links"}
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
              <ThemedText style={styles.fieldLabel}>Copyright Text</ThemedText>
              <ThemedText
                style={{
                  fontSize: 11,
                  color: copyrightText.length > 200 ? COLORS.error : mutedColor,
                }}
              >
                {copyrightText.length}/200
              </ThemedText>
            </View>
            <Input
              value={copyrightText}
              onChangeText={setCopyrightText}
              placeholder={`© ${new Date().getFullYear()} ${brand.appName}. All rights reserved.`}
              maxLength={200}
            />
            <ThemedText style={{ fontSize: 11, color: mutedColor, marginTop: 4 }}>
              Shown in the site footer. Leave blank to use the default above.
            </ThemedText>
          </View>

          <View style={{ gap: SPACING.sm }}>
            <ThemedText style={styles.fieldLabel}>Social Links</ThemedText>
            {SOCIAL_FIELDS.map(({ key, icon, label, placeholder }) => (
              <View
                key={key}
                style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}
              >
                <Ionicons name={icon} size={18} color={mutedColor} style={{ width: 20 }} />
                <View style={{ flex: 1 }}>
                  <Input
                    value={socialLinks[key] ?? ""}
                    onChangeText={(text) => setSocialLinks((prev) => ({ ...prev, [key]: text }))}
                    placeholder={placeholder}
                    autoCapitalize="none"
                    keyboardType="url"
                    accessibilityLabel={label}
                  />
                </View>
              </View>
            ))}
          </View>

          {msg && (
            <ThemedText style={msg.ok ? styles.successText : styles.errorText}>
              {msg.text}
            </ThemedText>
          )}

          <Button onPress={handleSave} disabled={saving || !formIsDirty} style={{ marginTop: 4 }}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </View>
      </AnimatedAccordion>
    </View>
  );
}
