import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View, Pressable, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { ButtonRow } from "@/components/common/ButtonRow";
import { useAppTheme } from "@/hooks/use-app-theme";
import { theme } from "@/theme/theme";
import {
  adminGetSocialLinks,
  adminCreateSocialLink,
  adminUpdateSocialLink,
  adminDeleteSocialLink,
  AdminSocialLinkDto,
} from "@/api/admin";
import { isValidUrl } from "@/utils/validation";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { styles as settingsStyles } from "./settings.styles";
import { styles } from "./FooterSettingsCard.styles";
import { SocialLinkEditForm, emptyEdit, type EditState, type IconKey } from "./SocialLinkEditForm";
import { SocialLinkRow } from "./SocialLinkRow";
import { useBrandDraftPublish } from "./BrandDraftContext";
import { saveBrandFields } from "./brandAutosave";
import { SaveStatus } from "./SaveStatus";
import { useAutosave } from "@/hooks/use-autosave";
import { Icon } from "@/components/common/Icon";

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

  const [links, setLinks] = useState<AdminSocialLinkDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [editState, setEditState] = useState<EditState>(emptyEdit());
  const [saving, setSaving] = useState(false);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  // Key is versioned because the default flipped to expanded: without it, a stored `false`
  // from the collapsed-by-default build would keep the card shut for anyone who saw that one.
  const [expanded, setExpanded] = usePersistedState("settings:footer:expanded:v2", true);

  useBrandDraftPublish({
    copyrightText,
    socialLinks: links.map((l) => ({ id: l.id, label: l.label, iconKey: l.iconKey })),
  });

  const copyrightAutosave = useAutosave({
    values: { copyrightText: copyrightText.trim() },
    saved: { copyrightText: brand.copyrightText ?? "" },
    save: saveBrandFields,
    onRestore: (previous) => setCopyrightText(previous.copyrightText),
  });

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

  const startEdit = (link: AdminSocialLinkDto) => {
    setEditingId(link.id);
    setLinkMsg(null);
    setEditState({
      label: link.label,
      url: link.url,
      iconKey: link.iconKey as IconKey,
      sortOrder: link.sortOrder,
    });
  };

  const startNew = () => {
    setEditingId("new");
    setLinkMsg(null);
    setEditState(emptyEdit(links.length));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setLinkMsg(null);
    setEditState(emptyEdit());
  };

  const clearStaleError = (s: EditState) => {
    setLinkMsg(null);
    setEditState(s);
  };

  const save = async () => {
    // istanbul ignore next -- unreachable: SocialLinkEditForm's own Save button is
    // disabled under this exact condition, so it can never be pressed to reach here.
    if (!editState.label.trim() || !editState.url.trim()) return;
    // Client-side URL pre-flight (mirrors backend UrlValidator) — catches obvious typos and
    // dangerous schemes like javascript: without a round-trip. The server remains source of truth.
    if (!isValidUrl(editState.url.trim())) {
      setLinkMsg("Enter a valid URL (e.g. https://example.com).");
      return;
    }
    setLinkMsg(null);
    setSaving(true);
    let ok = true;
    let message: string | null = null;
    if (editingId === "new") {
      const result = await adminCreateSocialLink({
        label: editState.label.trim(),
        url: editState.url.trim(),
        iconKey: editState.iconKey,
        sortOrder: editState.sortOrder,
      });
      if (result && result.ok) {
        setLinks((prev) => [...prev, result.data]);
      } else if (result && !result.ok) {
        ok = false;
        message = result.message;
      } else {
        ok = false;
        message = "Couldn't reach the server. Please try again.";
      }
      // Unreachable: save() only ever runs while a form is open, which means editingId
      // is always "new" or a link id here, never null.
    } else if (editingId != null) {
      /* istanbul ignore else */ const result = await adminUpdateSocialLink(editingId, {
        label: editState.label.trim(),
        url: editState.url.trim(),
        iconKey: editState.iconKey,
        sortOrder: editState.sortOrder,
      });
      if (result && result.ok) {
        setLinks((prev) => prev.map((l) => (l.id === editingId ? result.data : l)));
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
      // Unreachable: every `ok = false` assignment above always pairs with a `message`
      // assignment, so message is guaranteed truthy here.
    } else if (message) {
      /* istanbul ignore else */ setLinkMsg(message);
    }
  };

  const remove = async (id: number) => {
    const ok = await adminDeleteSocialLink(id);
    if (ok) setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <View style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <Pressable
        style={settingsStyles.secHeader}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="Footer"
        accessibilityState={{ expanded }}
      >
        <View style={[settingsStyles.secIcon, { backgroundColor: `${primaryColor}20` }]}>
          <Icon name="link-outline" size="xl" color={primaryColor} />
        </View>
        <View style={settingsStyles.secHeaderCopy}>
          <ThemedText style={settingsStyles.secTitle}>Footer</ThemedText>
          <ThemedText style={[settingsStyles.secSub, { color: mutedColor }]} numberOfLines={1}>
            {loading
              ? "Loading…"
              : links.length > 0
                ? `${links.length} social link${links.length !== 1 ? "s" : ""} configured`
                : "Copyright text and social links"}
          </ThemedText>
        </View>
        <Icon name={expanded ? "chevron-up" : "chevron-down"} size="lg" color={mutedColor} />
      </Pressable>

      <AnimatedAccordion expanded={expanded}>
        <View style={[settingsStyles.secForm, { borderTopColor: borderColor }]}>
          <View style={settingsStyles.field}>
            <View style={settingsStyles.fieldHeader}>
              <ThemedText style={settingsStyles.fieldLabel}>Copyright Text</ThemedText>
              <ThemedText
                style={[
                  settingsStyles.fieldCharCount,
                  { color: copyrightText.length > 200 ? theme.colors.error : mutedColor },
                ]}
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
            <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
              Shown in the site footer. Leave blank to use the default above.
            </ThemedText>
            <SaveStatus
              status={copyrightAutosave.status}
              error={copyrightAutosave.error}
              onRetry={copyrightAutosave.retry}
              onUndo={copyrightAutosave.undo}
              mutedColor={mutedColor}
              testID="copyright-save-status"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: borderColor }]} />

          <View style={styles.linksSection}>
            <ThemedText style={settingsStyles.fieldLabel}>Social Links</ThemedText>

            {loading ? (
              <ActivityIndicator color={primaryColor} />
            ) : (
              <View style={styles.linksList}>
                {links.length === 0 && editingId !== "new" && (
                  <View style={[settingsStyles.emptyState, { borderColor }]}>
                    <Icon name="link-outline" size={22} color={mutedColor} />
                    <ThemedText style={[settingsStyles.emptyStateText, { color: mutedColor }]}>
                      No links yet. Press Add to create your first one.
                    </ThemedText>
                  </View>
                )}
                {links.map((link) => (
                  <View key={link.id}>
                    {editingId === link.id ? (
                      <SocialLinkEditForm
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
                        // The condition is redundant (always true) since this whole branch
                        // only renders when `editingId === link.id`; kept for type-narrowing.
                        error={editingId === link.id ? linkMsg : /* istanbul ignore next */ null}
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
                    onChange={clearStaleError}
                    onSave={save}
                    onCancel={cancelEdit}
                    saving={saving}
                    primaryColor={primaryColor}
                    surface2={surface2}
                    borderColor={borderColor}
                    mutedColor={mutedColor}
                    colors={colors}
                    // Same redundant-but-type-narrowing condition as above: this block only
                    // renders when `editingId === "new"`.
                    error={editingId === "new" ? linkMsg : /* istanbul ignore next */ null}
                    isNew
                  />
                )}

                {editingId !== "new" && (
                  <ButtonRow align="start">
                    <Button
                      size="md"
                      icon="add"
                      onPress={startNew}
                      accessibilityLabel="Add social link"
                    >
                      Add
                    </Button>
                  </ButtonRow>
                )}
              </View>
            )}
          </View>
        </View>
      </AnimatedAccordion>
    </View>
  );
}
