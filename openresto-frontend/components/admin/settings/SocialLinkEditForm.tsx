import { type ComponentProps } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import { Ionicons } from "@expo/vector-icons";
import { ThemeColors } from "@/theme/theme";
import { styles } from "./settings.styles";

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
              <Ionicons
                name={icon as ComponentProps<typeof Ionicons>["name"]}
                size={18}
                color={state.iconKey === icon ? primaryColor : mutedColor}
              />
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: 4 }}>
        <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Label</ThemedText>
        <Input
          value={state.label}
          onChangeText={(v) => onChange({ ...state, label: v })}
          placeholder="e.g. Instagram, Yelp, Menu PDF"
        />
      </View>

      <View style={{ gap: 4 }}>
        <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>URL</ThemedText>
        <Input
          value={state.url}
          onChangeText={(v) => onChange({ ...state, url: v })}
          placeholder="https://instagram.com/yourresto"
          autoCapitalize="none"
          keyboardType="url"
        />
      </View>

      {error ? <ThemedText style={[styles.errorText, { marginTop: 2 }]}>{error}</ThemedText> : null}

      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel editing this link"
          style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }}
        >
          <ThemedText style={{ fontSize: 14, color: mutedColor }}>Cancel</ThemedText>
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={saving || !state.label.trim() || !state.url.trim()}
          accessibilityRole="button"
          accessibilityLabel="Save this link"
          accessibilityState={{
            disabled: saving || !state.label.trim() || !state.url.trim(),
            busy: saving,
          }}
          style={{
            opacity: saving || !state.label.trim() || !state.url.trim() ? 0.5 : 1,
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
