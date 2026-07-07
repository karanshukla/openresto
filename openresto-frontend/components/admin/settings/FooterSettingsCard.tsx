import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View, Pressable, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { COLORS } from "@/theme/theme";
import {
  saveBrandSettings,
  adminGetSocialLinks,
  adminCreateSocialLink,
  adminUpdateSocialLink,
  adminDeleteSocialLink,
  AdminSocialLinkDto,
} from "@/api/admin";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { styles } from "./settings.styles";
import { SocialLinkEditForm, emptyEdit, type EditState, type IconKey } from "./SocialLinkEditForm";
import { SocialLinkRow } from "./SocialLinkRow";

export function FooterSettingsCard({
  borderColor,
  mutedColor,
  cardBg,
}: {
  borderColor: string;
  mutedColor: string;
  cardBg: string;
}) {
  const { colors, isDark, brand, primaryColor } = useAppTheme();
  const surface2 = isDark ? "#252729" : "#f9fafb";

  const [copyrightText, setCopyrightText] = useState(brand.copyrightText ?? "");
  const [savingCopyright, setSavingCopyright] = useState(false);
  const [copyrightMsg, setCopyrightMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [links, setLinks] = useState<AdminSocialLinkDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [editState, setEditState] = useState<EditState>(emptyEdit());
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = usePersistedState("settings:footer:expanded", false);

  const copyrightIsDirty = copyrightText.trim() !== (brand.copyrightText ?? "");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCopyrightText(brand.copyrightText ?? "");
  }, [brand]);

  useEffect(() => {
    adminGetSocialLinks().then((data) => {
      setLinks(data);
      setLoading(false);
    });
  }, []);

  const handleSaveCopyright = async () => {
    setSavingCopyright(true);
    setCopyrightMsg(null);
    const result = await saveBrandSettings({ copyrightText: copyrightText.trim() });
    setSavingCopyright(false);
    if (result) {
      setCopyrightMsg({ text: result.message, ok: !result.message.toLowerCase().includes("fail") });
    } else {
      setCopyrightMsg({ text: "Failed to save.", ok: false });
    }
  };

  const startEdit = (link: AdminSocialLinkDto) => {
    setEditingId(link.id);
    setEditState({
      label: link.label,
      url: link.url,
      iconKey: link.iconKey as IconKey,
      sortOrder: link.sortOrder,
    });
  };

  const startNew = () => {
    setEditingId("new");
    setEditState(emptyEdit(links.length));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditState(emptyEdit());
  };

  const save = async () => {
    if (!editState.label.trim() || !editState.url.trim()) return;
    setSaving(true);
    if (editingId === "new") {
      const created = await adminCreateSocialLink({
        label: editState.label.trim(),
        url: editState.url.trim(),
        iconKey: editState.iconKey,
        sortOrder: editState.sortOrder,
      });
      if (created) setLinks((prev) => [...prev, created]);
    } else if (editingId != null) {
      const updated = await adminUpdateSocialLink(editingId, {
        label: editState.label.trim(),
        url: editState.url.trim(),
        iconKey: editState.iconKey,
        sortOrder: editState.sortOrder,
      });
      if (updated) {
        setLinks((prev) => prev.map((l) => (l.id === editingId ? updated : l)));
      }
    }
    setSaving(false);
    cancelEdit();
  };

  const remove = async (id: number) => {
    const ok = await adminDeleteSocialLink(id);
    if (ok) setLinks((prev) => prev.filter((l) => l.id !== id));
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
            {loading
              ? "Loading…"
              : links.length > 0
                ? `${links.length} social link${links.length !== 1 ? "s" : ""} configured`
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
            {copyrightMsg && (
              <ThemedText
                style={[copyrightMsg.ok ? styles.successText : styles.errorText, { marginTop: 4 }]}
              >
                {copyrightMsg.text}
              </ThemedText>
            )}
            <Pressable
              onPress={handleSaveCopyright}
              disabled={savingCopyright || !copyrightIsDirty}
              accessibilityLabel="Save copyright text"
              style={{
                opacity: savingCopyright || !copyrightIsDirty ? 0.5 : 1,
                backgroundColor: primaryColor,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 8,
                alignSelf: "flex-start",
                marginTop: 8,
              }}
            >
              <ThemedText style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>
                {savingCopyright ? "Saving…" : "Save"}
              </ThemedText>
            </Pressable>
          </View>

          <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 4 }} />

          <View style={{ gap: 12 }}>
            <ThemedText style={styles.fieldLabel}>Social Links</ThemedText>

            <Pressable
              onPress={startNew}
              style={{
                backgroundColor: primaryColor,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 8,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                alignSelf: "flex-start",
              }}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <ThemedText style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>
                Add
              </ThemedText>
            </Pressable>

            {loading ? (
              <ActivityIndicator color={primaryColor} />
            ) : (
              <View style={{ gap: 8 }}>
                {links.length === 0 && editingId !== "new" && (
                  <View
                    style={{
                      padding: 20,
                      alignItems: "center",
                      gap: 6,
                      borderWidth: 1,
                      borderColor,
                      borderRadius: 10,
                      borderStyle: "dashed" as const,
                    }}
                  >
                    <Ionicons name="link-outline" size={22} color={mutedColor} />
                    <ThemedText style={{ fontSize: 13, color: mutedColor, textAlign: "center" }}>
                      No links yet. Press Add to create your first one.
                    </ThemedText>
                  </View>
                )}
                {links.map((link) => (
                  <View key={link.id}>
                    {editingId === link.id ? (
                      <SocialLinkEditForm
                        state={editState}
                        onChange={setEditState}
                        onSave={save}
                        onCancel={cancelEdit}
                        saving={saving}
                        primaryColor={primaryColor}
                        surface2={surface2}
                        borderColor={borderColor}
                        mutedColor={mutedColor}
                        colors={colors}
                      />
                    ) : (
                      <SocialLinkRow
                        link={link}
                        onEdit={startEdit}
                        onDelete={remove}
                        primaryColor={primaryColor}
                        cardBg={cardBg}
                        borderColor={borderColor}
                        mutedColor={mutedColor}
                        surface2={surface2}
                      />
                    )}
                  </View>
                ))}

                {editingId === "new" && (
                  <SocialLinkEditForm
                    state={editState}
                    onChange={setEditState}
                    onSave={save}
                    onCancel={cancelEdit}
                    saving={saving}
                    primaryColor={primaryColor}
                    surface2={surface2}
                    borderColor={borderColor}
                    mutedColor={mutedColor}
                    colors={colors}
                  />
                )}
              </View>
            )}
          </View>
        </View>
      </AnimatedAccordion>
    </View>
  );
}
