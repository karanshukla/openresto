import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View, Pressable, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
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
import { isValidUrl } from "@/utils/validation";
import { styles } from "./settings.styles";
import { Icon, type IconName } from "@/components/common/Icon";

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
  const [highlightMsg, setHighlightMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = usePersistedState("settings:highlights:expanded", true);

  useEffect(() => {
    adminGetHighlights().then((data) => {
      setHighlights(data);
      setLoading(false);
    });
  }, []);

  const startEdit = (h: AdminHighlightDto) => {
    setEditingId(h.id);
    setHighlightMsg(null);
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
    setHighlightMsg(null);
    setEditState(emptyEdit(highlights.length));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setHighlightMsg(null);
    setEditState(emptyEdit());
  };

  const clearStaleError = (s: EditState) => {
    setHighlightMsg(null);
    setEditState(s);
  };

  const save = async () => {
    if (!editState.title.trim()) return;
    // Client-side URL pre-flight on the optional link (mirrors backend UrlValidator). The link
    // is optional, so only validate when the admin actually entered something.
    const trimmedLink = editState.link.trim();
    if (trimmedLink && !isValidUrl(trimmedLink)) {
      setHighlightMsg("Enter a valid link URL (e.g. https://example.com).");
      return;
    }
    setHighlightMsg(null);
    setSaving(true);
    let ok = true;
    let message: string | null = null;
    if (editingId === "new") {
      const result = await adminCreateHighlight({
        title: editState.title.trim(),
        body: editState.body.trim(),
        iconKey: editState.iconKey,
        sortOrder: editState.sortOrder,
        link: trimmedLink || null,
      });
      if (result && result.ok) {
        setHighlights((prev) => [...prev, result.data]);
      } else if (result && !result.ok) {
        ok = false;
        message = result.message;
      } else {
        ok = false;
        message = "Couldn't reach the server. Please try again.";
      }
    } else if (editingId != null) {
      const result = await adminUpdateHighlight(editingId, {
        title: editState.title.trim(),
        body: editState.body.trim(),
        iconKey: editState.iconKey,
        sortOrder: editState.sortOrder,
        link: trimmedLink || null,
      });
      if (result && result.ok) {
        setHighlights((prev) => prev.map((h) => (h.id === editingId ? result.data : h)));
      } else if (result && !result.ok) {
        ok = false;
        message = result.message;
      } else {
        ok = false;
        message = "Couldn't reach the server. Please try again.";
      }
    }
    setSaving(false);
    if (ok) {
      cancelEdit();
    } else if (message) {
      setHighlightMsg(message);
    }
  };

  const remove = async (id: number) => {
    const ok = await adminDeleteHighlight(id);
    if (ok) setHighlights((prev) => prev.filter((h) => h.id !== id));
  };

  return (
    <View style={[styles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <Pressable
        style={styles.secHeader}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="Highlights"
        accessibilityState={{ expanded }}
      >
        <View style={[styles.secIcon, { backgroundColor: `${primaryColor}20` }]}>
          <Icon name="sparkles-outline" size="xl" color={primaryColor} />
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
        <Icon name={expanded ? "chevron-up" : "chevron-down"} size="lg" color={mutedColor} />
      </Pressable>

      <AnimatedAccordion expanded={expanded}>
        <View style={[styles.secForm, { borderTopColor: borderColor, gap: 12 }]}>
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
                  <Icon name="sparkles-outline" size={22} color={mutedColor} />
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
                      onChange={clearStaleError}
                      onSave={save}
                      onCancel={cancelEdit}
                      saving={saving}
                      primaryColor={primaryColor}
                      surface2={surface2}
                      borderColor={borderColor}
                      mutedColor={mutedColor}
                      colors={colors}
                      error={editingId === h.id ? highlightMsg : null}
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
                        <Icon name={h.iconKey as IconName} size="lg" color={primaryColor} />
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
                            <Icon name="link-outline" size={11} color={primaryColor} />
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
                        <Pressable
                          onPress={() => startEdit(h)}
                          style={{ padding: 6 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Edit highlight ${h.title}`}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Icon name="pencil-outline" size="md" color={mutedColor} />
                        </Pressable>
                        <Pressable
                          onPress={() => remove(h.id)}
                          style={{ padding: 6 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete highlight ${h.title}`}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Icon name="trash-outline" size="md" color="#ef4444" />
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              ))}

              {editingId === "new" && (
                <HighlightEditForm
                  state={editState}
                  onChange={clearStaleError}
                  onSave={save}
                  onCancel={cancelEdit}
                  saving={saving}
                  primaryColor={primaryColor}
                  surface2={surface2}
                  borderColor={borderColor}
                  mutedColor={mutedColor}
                  colors={colors}
                  error={editingId === "new" ? highlightMsg : null}
                />
              )}

              {editingId !== "new" && (
                <Pressable
                  onPress={startNew}
                  accessibilityRole="button"
                  accessibilityLabel="Add highlight"
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
                  <Icon name="add" size="md" color="#fff" />
                  <ThemedText style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>
                    Add
                  </ThemedText>
                </Pressable>
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
  error,
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
  /** Inline validation/server error shown above the action row. Null/undefined hides it. */
  error?: string | null;
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
      <View style={{ gap: 6 }}>
        <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Icon</ThemedText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {ICON_OPTIONS.map((icon) => (
            <Pressable
              key={icon}
              onPress={() => onChange({ ...state, iconKey: icon })}
              accessibilityRole="radio"
              accessibilityLabel={`${icon} icon`}
              accessibilityState={{ checked: state.iconKey === icon }}
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
              <Icon
                name={icon as IconName}
                size="lg"
                color={state.iconKey === icon ? primaryColor : mutedColor}
              />
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: 4 }}>
        <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Title</ThemedText>
        <Input
          value={state.title}
          onChangeText={(v) => onChange({ ...state, title: v })}
          placeholder="e.g. Wood-fired kitchen"
        />
      </View>

      <View style={{ gap: 4 }}>
        <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Description</ThemedText>
        <Input
          value={state.body}
          onChangeText={(v) => onChange({ ...state, body: v })}
          placeholder="Short sentence about this highlight"
          multiline
          numberOfLines={3}
          style={{ height: 76, paddingTop: 10, paddingBottom: 10 }}
        />
      </View>

      <View style={{ gap: 4 }}>
        <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Link (optional)</ThemedText>
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

      {error ? <ThemedText style={[styles.errorText, { marginTop: 2 }]}>{error}</ThemedText> : null}

      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel editing this highlight"
          style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }}
        >
          <ThemedText style={{ fontSize: 14, color: mutedColor }}>Cancel</ThemedText>
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={saving || !state.title.trim()}
          accessibilityRole="button"
          accessibilityLabel="Save this highlight"
          accessibilityState={{ disabled: saving || !state.title.trim(), busy: saving }}
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
          <Icon name="checkmark" size="sm" color="#fff" />
          <ThemedText style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>
            {saving ? "Saving…" : "Save"}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}
