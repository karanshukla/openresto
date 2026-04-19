import { useState, useEffect } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/theme/theme";
import { saveBrandSettings } from "@/api/admin";
import { useBrand } from "@/context/BrandContext";
import { styles } from "./settings.styles";

const MAX_LOGO_KB = 256;

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
  const [appName, setAppName] = useState(brand.appName);
  const [primaryColor, setPrimaryColor] = useState(brand.primaryColor);
  const [logoPreview, setLogoPreview] = useState<string | null>(brand.logoUrl ?? null);
  const [logoData, setLogoData] = useState<string | undefined>(undefined); // undefined = no change
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setAppName(brand.appName);
    setPrimaryColor(brand.primaryColor);
    setLogoPreview(brand.logoUrl ?? null);
  }, [brand]);

  const handlePickLogo = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/svg+xml,image/webp";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_LOGO_KB * 1024) {
        setMsg({
          text: `Logo must be under ${MAX_LOGO_KB} KB. Yours is ${Math.round(file.size / 1024)} KB.`,
          ok: false,
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setLogoPreview(dataUrl);
        setLogoData(dataUrl);
        setMsg(null);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    const result = await saveBrandSettings({
      appName,
      primaryColor,
      logoBase64: logoData,
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
            {appName} · {primaryColor}
          </ThemedText>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={mutedColor} />
      </Pressable>

      {expanded && (
        <View style={[styles.secForm, { borderTopColor: borderColor }]}>
          <View style={styles.field}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <ThemedText style={styles.fieldLabel}>App Name</ThemedText>
              <ThemedText style={{ fontSize: 11, color: appName.length > 32 ? COLORS.error : mutedColor }}>
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
                  onPress={() => setPrimaryColor(c)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: c,
                    borderWidth: primaryColor === c ? 3 : 0,
                    borderColor: "#fff",
                    shadowColor: "#000",
                    shadowOpacity: primaryColor === c ? 0.3 : 0,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 2 },
                  }}
                />
              ))}
              <Input
                value={primaryColor}
                onChangeText={setPrimaryColor}
                placeholder="#0a7ea4"
                style={{ width: 100 }}
              />
            </View>
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>Logo (max {MAX_LOGO_KB} KB)</ThemedText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {logoPreview ? (
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor,
                  }}
                >
                  <img
                    src={logoPreview}
                    alt="Logo"
                    style={{ width: 48, height: 48, objectFit: "contain" }}
                  />
                </View>
              ) : (
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="image-outline" size={20} color={mutedColor} />
                </View>
              )}
              <Pressable style={[styles.secBtn, { borderColor }]} onPress={handlePickLogo}>
                <ThemedText style={[styles.secBtnText, { color: primaryColor }]}>
                  {logoPreview ? "Change" : "Upload"}
                </ThemedText>
              </Pressable>
              {logoPreview && (
                <Pressable
                  style={[styles.secBtn, { borderColor }]}
                  onPress={() => {
                    setLogoPreview(null);
                    setLogoData("");
                  }}
                >
                  <ThemedText style={[styles.secBtnText, { color: COLORS.error }]}>
                    Delete
                  </ThemedText>
                </Pressable>
              )}
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
            {saving ? "Saving…" : "Save Brand Settings"}
          </Button>

          <ThemedText style={{ fontSize: 12, color: mutedColor, marginTop: 4 }}>
            Changes take effect after a page reload. Logo is stored in the database — no CDN
            required.
          </ThemedText>
        </View>
      )}
    </View>
  );
}
