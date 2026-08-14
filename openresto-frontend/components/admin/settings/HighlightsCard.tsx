import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View, Pressable, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import { useAppTheme } from "@/hooks/use-app-theme";
import { theme, ThemeColors } from "@/theme/theme";
import {
  adminGetHighlights,
  adminCreateHighlight,
  adminUpdateHighlight,
  adminDeleteHighlight,
  AdminHighlightDto,
} from "@/api/admin";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { isValidUrl } from "@/utils/validation";
import { styles as settingsStyles } from "./settings.styles";
import { styles } from "./HighlightsCard.styles";
import Button from "@/components/common/Button";
import { ButtonRow } from "@/components/common/ButtonRow";
import { RowTextButton } from "@/components/common/RowTextButton";
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
    <View style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <Pressable
        style={settingsStyles.secHeader}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="Highlights"
        accessibilityState={{ expanded }}
      >
        <View style={[settingsStyles.secIcon, { backgroundColor: `${primaryColor}20` }]}>
          <Icon name="sparkles-outline" size="xl" color={primaryColor} />
        </View>
        <View style={settingsStyles.secHeaderCopy}>
          <ThemedText style={settingsStyles.secTitle}>Highlights</ThemedText>
          <ThemedText style={[settingsStyles.secSub, { color: mutedColor }]}>
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
        <View style={[settingsStyles.secForm, { borderTopColor: borderColor, gap: 12 }]}>
          {loading ? (
            <ActivityIndicator color={primaryColor} />
          ) : (
            <View style={styles.list}>
              {highlights.length === 0 && editingId !== "new" && (
                <View style={[settingsStyles.emptyState, { borderColor }]}>
                  <Icon name="sparkles-outline" size={22} color={mutedColor} />
                  <ThemedText style={[settingsStyles.emptyStateText, { color: mutedColor }]}>
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
                      style={[
                        settingsStyles.tile,
                        styles.tileTop,
                        { backgroundColor: surface2, borderColor },
                      ]}
                    >
                      <View
                        style={[settingsStyles.tileIcon, { backgroundColor: cardBg, borderColor }]}
                      >
                        <Icon name={h.iconKey as IconName} size="lg" color={primaryColor} />
                      </View>
                      <View style={settingsStyles.tileCopy}>
                        <ThemedText style={settingsStyles.tileTitle}>{h.title}</ThemedText>
                        <ThemedText style={[styles.body, { color: mutedColor }]}>
                          {h.body}
                        </ThemedText>
                        {h.link ? (
                          <View style={styles.linkRow}>
                            <Icon name="link-outline" size={11} color={primaryColor} />
                            <ThemedText
                              style={[styles.linkText, { color: primaryColor }]}
                              numberOfLines={1}
                            >
                              {h.link}
                            </ThemedText>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.actions}>
                        <RowTextButton
                          label="Edit"
                          icon="pencil-outline"
                          color={mutedColor}
                          onPress={() => startEdit(h)}
                          accessibilityLabel={`Edit highlight ${h.title}`}
                        />
                        <RowTextButton
                          label="Delete"
                          icon="trash-outline"
                          color={theme.colors.error}
                          onPress={() => remove(h.id)}
                          accessibilityLabel={`Delete highlight ${h.title}`}
                        />
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
                <ButtonRow align="start">
                  <Button
                    size="md"
                    icon="add"
                    onPress={startNew}
                    accessibilityLabel="Add highlight"
                  >
                    Add
                  </Button>
                </ButtonRow>
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
    <View style={[settingsStyles.editForm, { backgroundColor: surface2, borderColor }]}>
      <View style={settingsStyles.editFormIconField}>
        <ThemedText style={[settingsStyles.fieldLabel, { color: mutedColor }]}>Icon</ThemedText>
        <View style={settingsStyles.editFormIconGrid}>
          {ICON_OPTIONS.map((icon) => (
            <Pressable
              key={icon}
              onPress={() => onChange({ ...state, iconKey: icon })}
              accessibilityRole="radio"
              accessibilityLabel={`${icon} icon`}
              accessibilityState={{ checked: state.iconKey === icon }}
              style={[
                settingsStyles.editFormSwatch,
                {
                  borderColor: state.iconKey === icon ? primaryColor : borderColor,
                  backgroundColor: state.iconKey === icon ? primaryColor + "22" : colors.input,
                },
              ]}
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

      <View style={settingsStyles.editFormField}>
        <ThemedText style={[settingsStyles.fieldLabel, { color: mutedColor }]}>Title</ThemedText>
        <Input
          value={state.title}
          onChangeText={(v) => onChange({ ...state, title: v })}
          placeholder="e.g. Wood-fired kitchen"
        />
      </View>

      <View style={settingsStyles.editFormField}>
        <ThemedText style={[settingsStyles.fieldLabel, { color: mutedColor }]}>
          Description
        </ThemedText>
        <Input
          value={state.body}
          onChangeText={(v) => onChange({ ...state, body: v })}
          placeholder="Short sentence about this highlight"
          multiline
          numberOfLines={3}
          style={styles.bodyInput}
        />
      </View>

      <View style={settingsStyles.editFormField}>
        <ThemedText style={[settingsStyles.fieldLabel, { color: mutedColor }]}>
          Link (optional)
        </ThemedText>
        <Input
          value={state.link}
          onChangeText={(v) => onChange({ ...state, link: v })}
          placeholder="https://example.com/menu"
          autoCapitalize="none"
          keyboardType="url"
        />
        <ThemedText style={[styles.linkHint, { color: mutedColor }]}>
          Makes the whole card clickable. Leave blank for a static highlight.
        </ThemedText>
      </View>

      {error ? (
        <ThemedText style={[settingsStyles.errorText, settingsStyles.editFormError]}>
          {error}
        </ThemedText>
      ) : null}

      <ButtonRow>
        <Button
          variant="secondary"
          tone="neutral"
          size="md"
          onPress={onCancel}
          accessibilityLabel="Cancel editing this highlight"
        >
          Cancel
        </Button>
        <Button
          size="md"
          icon="checkmark"
          onPress={onSave}
          disabled={saving || !state.title.trim()}
          loading={saving}
          accessibilityLabel="Save this highlight"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </ButtonRow>
    </View>
  );
}
