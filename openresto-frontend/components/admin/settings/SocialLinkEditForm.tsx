import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { ButtonRow } from "@/components/common/ButtonRow";
import { ThemeColors } from "@/theme/theme";
import { styles } from "./settings.styles";
import { Icon, type IconName } from "@/components/common/Icon";

/**
 * The icon-picker + label/url inputs + save/cancel actions used when creating or editing a
 * social link in the FooterSettingsCard.
 */

const ICON_OPTIONS = [
  "link-outline",
  "globe-outline",
  "mail-outline",
  "call-outline",
  "chatbubble-outline",
  "location-outline",
  "star-outline",
  "heart-outline",
  "megaphone-outline",
  "newspaper-outline",
  "storefront-outline",
  "cart-outline",
  "calendar-outline",
  "camera-outline",
  "logo-instagram",
  "logo-facebook",
  "logo-x",
  "logo-tiktok",
  "logo-youtube",
  "logo-linkedin",
  "logo-pinterest",
  "logo-whatsapp",
  "logo-snapchat",
  "logo-threads",
  "logo-reddit",
  "logo-discord",
] as const;

export type IconKey = (typeof ICON_OPTIONS)[number];

export interface EditState {
  label: string;
  url: string;
  iconKey: IconKey;
  sortOrder: number;
}

export function emptyEdit(sortOrder = 0): EditState {
  return { label: "", url: "", iconKey: "link-outline", sortOrder };
}

export function SocialLinkEditForm({
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
  return (
    <View style={[styles.editForm, { backgroundColor: surface2, borderColor }]}>
      <View style={styles.editFormIconField}>
        <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Icon</ThemedText>
        <View style={styles.editFormIconGrid}>
          {ICON_OPTIONS.map((icon) => (
            <Pressable
              key={icon}
              onPress={() => onChange({ ...state, iconKey: icon })}
              accessibilityRole="radio"
              accessibilityLabel={`${icon} icon`}
              accessibilityState={{ checked: state.iconKey === icon }}
              style={[
                styles.editFormSwatch,
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

      <View style={styles.editFormField}>
        <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Label</ThemedText>
        <Input
          value={state.label}
          onChangeText={(v) => onChange({ ...state, label: v })}
          placeholder="e.g. Instagram, Yelp, Menu PDF"
        />
      </View>

      <View style={styles.editFormField}>
        <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>URL</ThemedText>
        <Input
          value={state.url}
          onChangeText={(v) => onChange({ ...state, url: v })}
          placeholder="https://instagram.com/yourresto"
          autoCapitalize="none"
          keyboardType="url"
        />
      </View>

      {error ? (
        <ThemedText style={[styles.errorText, styles.editFormError]}>{error}</ThemedText>
      ) : null}

      <ButtonRow>
        <Button
          variant="secondary"
          tone="neutral"
          size="md"
          onPress={onCancel}
          accessibilityLabel="Cancel editing this link"
        >
          Cancel
        </Button>
        <Button
          size="md"
          icon={isNew ? "add" : "checkmark"}
          onPress={onSave}
          disabled={saving || !state.label.trim() || !state.url.trim()}
          loading={saving}
          accessibilityLabel={isNew ? "Add this link" : "Save this link"}
        >
          {isNew ? (saving ? "Adding…" : "Add") : saving ? "Saving…" : "Save"}
        </Button>
      </ButtonRow>
    </View>
  );
}
