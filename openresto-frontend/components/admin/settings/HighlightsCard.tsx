import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View, Pressable, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
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
import { useBrand } from "@/context/BrandContext";
import { useAutosave } from "@/hooks/use-autosave";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { isValidUrl } from "@/utils/validation";
import { styles as settingsStyles } from "./settings.styles";
import { AccordionCardHeader } from "./AccordionCardHeader";
import { styles } from "./HighlightsCard.styles";
import { useBrandDraftPublish } from "./BrandDraftContext";
import { saveBrandFields } from "./brandAutosave";
import { SaveStatus } from "./SaveStatus";
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
  const { t } = useTranslation();
  const { colors, isDark, primaryColor } = useAppTheme();
  const brand = useBrand();
  const surface2 = isDark ? "#252729" : "#f9fafb";

  const [highlights, setHighlights] = useState<AdminHighlightDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [editState, setEditState] = useState<EditState>(emptyEdit());
  const [saving, setSaving] = useState(false);
  const [highlightMsg, setHighlightMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = usePersistedState("settings:highlights:expanded", true);

  const [heading, setHeading] = useState(brand.highlightsHeading ?? "");
  const [subheading, setSubheading] = useState(brand.highlightsSubheading ?? "");

  useBrandDraftPublish({
    highlightsHeading: heading,
    highlightsSubheading: subheading,
    highlights: highlights.map((h) => ({
      id: h.id,
      title: h.title,
      body: h.body,
      iconKey: h.iconKey,
      link: h.link,
    })),
  });

  const copyAutosave = useAutosave({
    values: {
      highlightsHeading: heading.trim(),
      highlightsSubheading: subheading.trim(),
    },
    saved: {
      highlightsHeading: brand.highlightsHeading ?? "",
      highlightsSubheading: brand.highlightsSubheading ?? "",
    },
    save: saveBrandFields,
    onRestore: (previous) => {
      setHeading(previous.highlightsHeading);
      setSubheading(previous.highlightsSubheading);
    },
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeading(brand.highlightsHeading ?? "");
    setSubheading(brand.highlightsSubheading ?? "");
  }, [brand]);

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
      setHighlightMsg(t("admin.settings.highlights.invalidLinkUrl"));
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
        message = t("admin.settings.highlights.serverUnreachable");
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
        message = t("admin.settings.highlights.serverUnreachable");
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
      <AccordionCardHeader
        icon="sparkles-outline"
        title={t("admin.settings.highlights.title")}
        subtitle={
          loading
            ? t("common.status.loading")
            : highlights.length > 0
              ? t("admin.settings.highlights.countSubtitle", { count: highlights.length })
              : t("admin.settings.highlights.noneSubtitle")
        }
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        primaryColor={primaryColor}
        mutedColor={mutedColor}
      />

      <AnimatedAccordion expanded={expanded}>
        <View style={[settingsStyles.secForm, { borderTopColor: borderColor, gap: 12 }]}>
          <View style={settingsStyles.fieldRow}>
            <View style={[settingsStyles.field, settingsStyles.fieldFlex]}>
              <ThemedText style={settingsStyles.fieldLabel}>
                {t("admin.settings.highlights.headingLabel")}
              </ThemedText>
              <Input
                value={heading}
                onChangeText={setHeading}
                placeholder={t("admin.settings.highlights.headingPlaceholder")}
                maxLength={60}
              />
              <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
                {t("admin.settings.highlights.headingHint")}
              </ThemedText>
            </View>

            <View style={[settingsStyles.field, settingsStyles.fieldFlex]}>
              <ThemedText style={settingsStyles.fieldLabel}>
                {t("admin.settings.highlights.subheadingLabel")}
              </ThemedText>
              <Input
                value={subheading}
                onChangeText={setSubheading}
                placeholder={t("admin.settings.highlights.subheadingPlaceholder")}
                maxLength={60}
              />
            </View>
          </View>

          <SaveStatus
            status={copyAutosave.status}
            error={copyAutosave.error}
            onRetry={copyAutosave.retry}
            onUndo={copyAutosave.undo}
            mutedColor={mutedColor}
            testID="highlights-copy-save-status"
          />

          <View style={[styles.divider, { backgroundColor: borderColor }]} />

          {loading ? (
            <ActivityIndicator color={primaryColor} />
          ) : (
            <View style={styles.list}>
              {highlights.length === 0 && editingId !== "new" && (
                <View style={[settingsStyles.emptyState, { borderColor }]}>
                  <Icon name="sparkles-outline" size={22} color={mutedColor} />
                  <ThemedText style={[settingsStyles.emptyStateText, { color: mutedColor }]}>
                    {t("admin.settings.highlights.emptyState")}
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
                          label={t("admin.settings.highlights.edit")}
                          icon="pencil-outline"
                          color={mutedColor}
                          onPress={() => startEdit(h)}
                          accessibilityLabel={t("admin.settings.highlights.editLabel", {
                            title: h.title,
                          })}
                        />
                        <RowTextButton
                          label={t("admin.settings.highlights.delete")}
                          icon="trash-outline"
                          color={theme.colors.error}
                          onPress={() => remove(h.id)}
                          accessibilityLabel={t("admin.settings.highlights.deleteLabel", {
                            title: h.title,
                          })}
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
                  isNew
                />
              )}

              {editingId !== "new" && (
                <ButtonRow align="start">
                  <Button
                    size="md"
                    icon="add"
                    onPress={startNew}
                    accessibilityLabel={t("admin.settings.highlights.addLabel")}
                  >
                    {t("admin.settings.highlights.add")}
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
  isNew = false,
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
  /** Labels the commit as a create rather than a save — the same form serves both. */
  isNew?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={[settingsStyles.editForm, { backgroundColor: surface2, borderColor }]}>
      <View style={settingsStyles.editFormIconField}>
        <ThemedText style={[settingsStyles.fieldLabel, { color: mutedColor }]}>
          {t("admin.settings.highlights.iconLabel")}
        </ThemedText>
        <View style={settingsStyles.editFormIconGrid}>
          {ICON_OPTIONS.map((icon) => (
            <Pressable
              key={icon}
              onPress={() => onChange({ ...state, iconKey: icon })}
              accessibilityRole="radio"
              accessibilityLabel={t("admin.settings.highlights.iconOptionLabel", { icon })}
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
        <ThemedText style={[settingsStyles.fieldLabel, { color: mutedColor }]}>
          {t("admin.settings.highlights.titleLabel")}
        </ThemedText>
        <Input
          value={state.title}
          onChangeText={(v) => onChange({ ...state, title: v })}
          placeholder={t("admin.settings.highlights.titlePlaceholder")}
        />
      </View>

      <View style={settingsStyles.editFormField}>
        <ThemedText style={[settingsStyles.fieldLabel, { color: mutedColor }]}>
          {t("admin.settings.highlights.descriptionLabel")}
        </ThemedText>
        <Input
          value={state.body}
          onChangeText={(v) => onChange({ ...state, body: v })}
          placeholder={t("admin.settings.highlights.descriptionPlaceholder")}
          multiline
          numberOfLines={3}
          style={styles.bodyInput}
        />
      </View>

      <View style={settingsStyles.editFormField}>
        <ThemedText style={[settingsStyles.fieldLabel, { color: mutedColor }]}>
          {t("admin.settings.highlights.linkLabel")}
        </ThemedText>
        <Input
          value={state.link}
          onChangeText={(v) => onChange({ ...state, link: v })}
          placeholder={t("admin.settings.highlights.linkPlaceholder")}
          autoCapitalize="none"
          keyboardType="url"
        />
        <ThemedText style={[styles.linkHint, { color: mutedColor }]}>
          {t("admin.settings.highlights.linkHint")}
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
          accessibilityLabel={t("admin.settings.highlights.cancelLabel")}
        >
          {t("common.actions.cancel")}
        </Button>
        <Button
          size="md"
          icon={isNew ? "add" : "checkmark"}
          onPress={onSave}
          disabled={saving || !state.title.trim()}
          loading={saving}
          accessibilityLabel={
            isNew
              ? t("admin.settings.highlights.addThisLabel")
              : t("admin.settings.highlights.saveThisLabel")
          }
        >
          {isNew
            ? saving
              ? t("common.status.adding")
              : t("admin.settings.highlights.add")
            : saving
              ? t("common.status.saving")
              : t("admin.settings.highlights.save")}
        </Button>
      </ButtonRow>
    </View>
  );
}
