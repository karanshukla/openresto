import { useState, useEffect, type ComponentProps } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View, Pressable, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { ThemeColors } from "@/theme/theme";
import {
  adminGetHighlights,
  adminCreateHighlight,
  adminUpdateHighlight,
  adminDeleteHighlight,
  AdminHighlightDto,
} from "@/api/admin";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { styles } from "./settings.styles";

const ICON_OPTIONS = [
  "flame-outline",
  "star-outline",
  "heart-outline",
  "sparkles-outline",
  "ribbon-outline",
  "trophy-outline",
  "thumbs-up-outline",
  "restaurant-outline",
  "wine-outline",
  "cafe-outline",
  "beer-outline",
  "pizza-outline",
  "ice-cream-outline",
  "leaf-outline",
  "nutrition-outline",
  "fish-outline",
  "egg-outline",
  "musical-notes-outline",
  "people-outline",
  "person-outline",
  "accessibility-outline",
  "car-outline",
  "wifi-outline",
  "card-outline",
  "gift-outline",
  "calendar-outline",
  "time-outline",
  "pricetag-outline",
  "camera-outline",
  "sunny-outline",
] as const;

type IconKey = (typeof ICON_OPTIONS)[number];

interface EditState {
  title: string;
  body: string;
  iconKey: IconKey;
  sortOrder: number;
  link: string;
}

function emptyEdit(sortOrder = 0): EditState {
  return { title: "", body: "", iconKey: "star-outline", sortOrder, link: "" };
}

export function HighlightsCard({
  borderColor,
  mutedColor,
  cardBg,
}: {
  borderColor: string;
  mutedColor: string;
  cardBg: string;
}) {
  const { colors, isDark, primaryColor } = useAppTheme();
  const surface2 = isDark ? "#252729" : "#f9fafb";

  const [highlights, setHighlights] = useState<AdminHighlightDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [editState, setEditState] = useState<EditState>(emptyEdit());
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = usePersistedState("settings:highlights:expanded", true);

  useEffect(() => {
    adminGetHighlights().then((data) => {
      setHighlights(data);
      setLoading(false);
    });
  }, []);

  const startEdit = (h: AdminHighlightDto) => {
    setEditingId(h.id);
    setEditState({
      title: h.title,
      body: h.body,
      iconKey: h.iconKey as IconKey,
      sortOrder: h.sortOrder,
      link: h.link ?? "",
    });
  };

  const startNew = () => {
    setEditingId("new");
    setEditState(emptyEdit(highlights.length));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditState(emptyEdit());
  };

  const save = async () => {
    if (!editState.title.trim()) return;
    setSaving(true);
    if (editingId === "new") {
      const created = await adminCreateHighlight({
        title: editState.title.trim(),
        body: editState.body.trim(),
        iconKey: editState.iconKey,
        sortOrder: editState.sortOrder,
        link: editState.link.trim() || null,
      });
      if (created) setHighlights((prev) => [...prev, created]);
    } else if (editingId != null) {
      const updated = await adminUpdateHighlight(editingId, {
        title: editState.title.trim(),
        body: editState.body.trim(),
        iconKey: editState.iconKey,
        sortOrder: editState.sortOrder,
        link: editState.link.trim() || null,
      });
      if (updated) {
        setHighlights((prev) => prev.map((h) => (h.id === editingId ? updated : h)));
      }
    }
    setSaving(false);
    cancelEdit();
  };

  const remove = async (id: number) => {
    const ok = await adminDeleteHighlight(id);
    if (ok) setHighlights((prev) => prev.filter((h) => h.id !== id));
  };

  return (
    <View style={[styles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <Pressable style={styles.secHeader} onPress={() => setExpanded((v) => !v)}>
        <View style={[styles.secIcon, { backgroundColor: `${primaryColor}20` }]}>
          <Ionicons name="sparkles-outline" size={20} color={primaryColor} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.secTitle}>Highlights</ThemedText>
          <ThemedText style={[styles.secSub, { color: mutedColor }]}>
            {loading
              ? "Loading…"
              : highlights.length > 0
                ? `${highlights.length} highlight${highlights.length !== 1 ? "s" : ""} · Home page`
                : "None configured · Home page"}
          </ThemedText>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={mutedColor} />
      </Pressable>

      <AnimatedAccordion expanded={expanded}>
        <View style={[styles.secForm, { borderTopColor: borderColor, gap: 12 }]}>
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
            <ThemedText style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>Add</ThemedText>
          </Pressable>

          {loading ? (
            <ActivityIndicator color={primaryColor} />
          ) : (
            <View style={{ gap: 8 }}>
              {highlights.length === 0 && editingId !== "new" && (
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
                  <Ionicons name="sparkles-outline" size={22} color={mutedColor} />
                  <ThemedText style={{ fontSize: 13, color: mutedColor, textAlign: "center" }}>
                    No highlights yet. Press Add to create your first one.
                  </ThemedText>
                </View>
              )}
              {highlights.map((h) => (
                <View key={h.id}>
                  {editingId === h.id ? (
                    <HighlightEditForm
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
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: 12,
                        backgroundColor: surface2,
                        borderWidth: 1,
                        borderColor,
                        borderRadius: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          backgroundColor: cardBg,
                          borderWidth: 1,
                          borderColor,
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Ionicons
                          name={h.iconKey as ComponentProps<typeof Ionicons>["name"]}
                          size={18}
                          color={primaryColor}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={{ fontSize: 14, fontWeight: "600" }}>
                          {h.title}
                        </ThemedText>
                        <ThemedText style={{ fontSize: 12, color: mutedColor, marginTop: 2 }}>
                          {h.body}
                        </ThemedText>
                        {h.link ? (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 3,
                              marginTop: 3,
                            }}
                          >
                            <Ionicons name="link-outline" size={11} color={primaryColor} />
                            <ThemedText
                              style={{ fontSize: 11, color: primaryColor }}
                              numberOfLines={1}
                            >
                              {h.link}
                            </ThemedText>
                          </View>
                        ) : null}
                      </View>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <Pressable onPress={() => startEdit(h)} style={{ padding: 6 }}>
                          <Ionicons name="pencil-outline" size={16} color={mutedColor} />
                        </Pressable>
                        <Pressable onPress={() => remove(h.id)} style={{ padding: 6 }}>
                          <Ionicons name="trash-outline" size={16} color="#ef4444" />
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              ))}

              {editingId === "new" && (
                <HighlightEditForm
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
      </AnimatedAccordion>
    </View>
  );
}

function HighlightEditForm({
  state,
  onChange,
  onSave,
  onCancel,
  saving,
  primaryColor,
  surface2,
  borderColor,
  mutedColor,
  colors,
}: {
  state: EditState;
  onChange: (s: EditState) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  primaryColor: string;
  surface2: string;
  borderColor: string;
  mutedColor: string;
  colors: ThemeColors;
}) {
  return (
    <View
      style={{
        padding: 14,
        backgroundColor: surface2,
        borderWidth: 1,
        borderColor,
        borderRadius: 10,
        gap: 10,
      }}
    >
      {/* Icon picker */}
      <View style={{ gap: 6 }}>
        <ThemedText style={{ fontSize: 12, color: mutedColor, fontWeight: "500" }}>Icon</ThemedText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {ICON_OPTIONS.map((icon) => (
            <Pressable
              key={icon}
              onPress={() => onChange({ ...state, iconKey: icon })}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: state.iconKey === icon ? primaryColor : borderColor,
                backgroundColor: state.iconKey === icon ? primaryColor + "22" : colors.input,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={icon as ComponentProps<typeof Ionicons>["name"]}
                size={18}
                color={state.iconKey === icon ? primaryColor : mutedColor}
              />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Title */}
      <View style={{ gap: 4 }}>
        <ThemedText style={{ fontSize: 12, color: mutedColor, fontWeight: "500" }}>
          Title
        </ThemedText>
        <Input
          value={state.title}
          onChangeText={(v) => onChange({ ...state, title: v })}
          placeholder="e.g. Wood-fired kitchen"
        />
      </View>

      {/* Body */}
      <View style={{ gap: 4 }}>
        <ThemedText style={{ fontSize: 12, color: mutedColor, fontWeight: "500" }}>
          Description
        </ThemedText>
        <Input
          value={state.body}
          onChangeText={(v) => onChange({ ...state, body: v })}
          placeholder="Short sentence about this highlight"
          multiline
          numberOfLines={3}
          style={{ height: 76, paddingTop: 10, paddingBottom: 10 }}
        />
      </View>

      {/* Link (optional) */}
      <View style={{ gap: 4 }}>
        <ThemedText style={{ fontSize: 12, color: mutedColor, fontWeight: "500" }}>
          Link (optional)
        </ThemedText>
        <Input
          value={state.link}
          onChangeText={(v) => onChange({ ...state, link: v })}
          placeholder="https://example.com/menu"
          autoCapitalize="none"
          keyboardType="url"
        />
        <ThemedText style={{ fontSize: 11, color: mutedColor }}>
          Makes the whole card clickable. Leave blank for a static highlight.
        </ThemedText>
      </View>

      {/* Actions */}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
        <Pressable
          onPress={onCancel}
          style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }}
        >
          <ThemedText style={{ fontSize: 14, color: mutedColor }}>Cancel</ThemedText>
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={saving || !state.title.trim()}
          style={{
            opacity: saving || !state.title.trim() ? 0.5 : 1,
            backgroundColor: primaryColor,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Ionicons name="checkmark" size={14} color="#fff" />
          <ThemedText style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>
            {saving ? "Saving…" : "Save"}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}
